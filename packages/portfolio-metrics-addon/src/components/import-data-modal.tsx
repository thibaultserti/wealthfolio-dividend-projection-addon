import React, { useState, useRef } from 'react';
import type { HostAPI } from '@wealthfolio/addon-sdk';
import { Button, Badge } from '@wealthfolio/ui';
import {
  UploadCloud,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  Trash2,
  X,
  FileSpreadsheet,
  Terminal,
} from 'lucide-react';
import {
  importFundamentalsFromCsv,
  clearFinancialsCache,
  getImportedDataStats,
} from '../services/financial-data-service';

interface ImportDataModalProps {
  api: HostAPI;
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  portfolioTickers: string[];
}

export const ImportDataModal: React.FC<ImportDataModalProps> = ({
  api,
  isOpen,
  onClose,
  onImported,
  portfolioTickers,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'script'>('import');
  const [dragOver, setDragOver] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedRowsCount, setParsedRowsCount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const scriptCommand = `python3 fetch_fundamentals.py ${portfolioTickers.join(' ')}`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(scriptCommand);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvContent(text);
      // Count lines
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      setParsedRowsCount(Math.max(0, lines.length - 1));
      setStatusMessage(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSaveImport = async () => {
    if (!csvContent) {
      setStatusMessage({ type: 'error', text: 'Veuillez sélectionner un fichier CSV.' });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await importFundamentalsFromCsv(csvContent, api);
      setStatusMessage({
        type: 'success',
        text: `Succès ! ${result.importedCount} actions importées avec métriques réelles.`,
      });
      setTimeout(() => {
        onImported();
        onClose();
      }, 900);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Erreur lors de l'import : ${err?.message || 'Format de fichier non valide'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = async () => {
    setIsProcessing(true);
    try {
      await clearFinancialsCache(api);
      setStatusMessage({ type: 'success', text: 'Données fondamentales effacées.' });
      setCsvContent('');
      setFileName('');
      setParsedRowsCount(null);
      setTimeout(() => {
        onImported();
      }, 500);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Import des Fondamentaux (CSV)</h2>
              <p className="text-xs text-muted-foreground">100% Données Réelles via Script Local</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-border/60 bg-muted/20 px-5 pt-3">
          <button
            type="button"
            className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'import'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('import')}
          >
            <UploadCloud className="w-4 h-4" />
            <span>1. Importer le CSV</span>
          </button>
          <button
            type="button"
            className={`pb-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'script'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('script')}
          >
            <Terminal className="w-4 h-4" />
            <span>2. Obtenir le script Python</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs sm:text-sm">
          {activeTab === 'import' ? (
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Importez votre fichier{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground font-semibold">
                  portfolio_fundamentals.csv
                </code>{' '}
                généré par le script local pour alimenter en direct les ratios fondamentaux.
              </p>

              {/* Drag & Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  dragOver
                    ? 'border-primary bg-primary/10'
                    : 'border-border/80 bg-muted/20 hover:bg-muted/40'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-semibold text-foreground text-xs block">
                    {fileName ? fileName : 'Cliquez ou glissez-déposez votre fichier CSV ici'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Fichier portfolio_fundamentals.csv généré en local
                  </span>
                </div>
                {parsedRowsCount != null && (
                  <Badge
                    variant="outline"
                    className="mt-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                  >
                    {parsedRowsCount} actions détectées prêtes à l'import
                  </Badge>
                )}
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground leading-relaxed">
                Exécutez cette commande dans votre terminal pour extraire automatiquement les
                fondamentaux de vos actions :
              </p>

              <div className="bg-muted/60 p-3.5 rounded-xl border border-border/80 font-mono text-xs text-foreground relative flex items-center justify-between gap-2 overflow-x-auto">
                <span className="text-emerald-400 select-all">{scriptCommand}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs flex items-center gap-1 shrink-0"
                  onClick={handleCopyCommand}
                >
                  {hasCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{hasCopied ? 'Copié' : 'Copier'}</span>
                </Button>
              </div>

              <div className="p-3 bg-muted/30 rounded-xl border border-border/60 text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground block">Comment ça marche ?</span>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                  <li>
                    Le script utilise Playwright / Google Finance pour extraire les vrais ratios
                    bilanciels.
                  </li>
                  <li>
                    Il crée le fichier{' '}
                    <code className="text-primary font-mono font-semibold">
                      portfolio_fundamentals.csv
                    </code>{' '}
                    dans votre dossier.
                  </li>
                  <li>
                    Revenez sur l'onglet <strong>1. Importer le CSV</strong> pour valider
                    l'affichage.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/60 bg-muted/20">
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1"
            onClick={handleClear}
            disabled={isProcessing}
          >
            <Trash2 className="w-3 h-3" />
            <span>Effacer les données</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fermer
            </Button>
            {activeTab === 'import' && (
              <Button size="sm" onClick={handleSaveImport} disabled={!csvContent || isProcessing}>
                {isProcessing ? 'Importation...' : 'Valider et Appliquer'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

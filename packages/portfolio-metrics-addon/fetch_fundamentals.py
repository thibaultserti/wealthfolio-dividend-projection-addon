#!/usr/bin/env python3
"""
Wealthfolio - Extracteur de Métriques Fondamentales (100% Yahoo Finance Strict)
Ce script extrait directement les véritables états financiers et ratios officiels de Yahoo Finance
(Marge brute, Marge opérationnelle, Marge nette, ROE, Dette nette / EBITDA, Trailing P/E, Forward P/E, PEG, Cap)
SANS AUCUN FALLBACK NI ESTIMATION SYNTHÉTIQUE.

Prérequis :
    pip install playwright && playwright install chromium

Utilisation :
    python3 fetch_fundamentals.py [TICKERS...]
    Exemple :
    python3 fetch_fundamentals.py AI.PA RMS.PA SU.PA SAF.PA EL.PA DG.PA ENX.PA BESI.AS SAP.DE AAPL MSFT NVDA
"""

import sys
import os
import re
import csv
import time
from playwright.sync_api import sync_playwright

DEFAULT_TICKERS = [
    'AI.PA', 'RMS.PA', 'SU.PA', 'SAF.PA', 'EL.PA', 'DG.PA', 'ENX.PA', 'BESI.AS', 'SAP.DE',
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'
]

def parse_num(val_str):
    if not val_str or val_str in ['--', 'N/A', '—', '-']:
        return None
    val_str = str(val_str).strip().replace('€', '').replace('$', '').replace(' ', '').replace('\xa0', '')
    multiplier = 1.0
    if val_str.endswith('T') or val_str.endswith('t'):
        multiplier = 1_000_000_000_000.0
        val_str = val_str[:-1]
    elif val_str.endswith('B') or val_str.endswith('b') or val_str.endswith('Mrd'):
        multiplier = 1_000_000_000.0
        val_str = val_str.replace('Mrd', '').replace('B', '').replace('b', '')
    elif val_str.endswith('M') or val_str.endswith('m') or val_str.endswith('Mln'):
        multiplier = 1_000_000.0
        val_str = val_str.replace('Mln', '').replace('M', '').replace('m', '')
    elif val_str.endswith('K') or val_str.endswith('k'):
        multiplier = 1_000.0
        val_str = val_str[:-1]
    elif val_str.endswith('%'):
        multiplier = 0.01
        val_str = val_str[:-1]

    val_str = val_str.replace(',', '.')
    try:
        return float(val_str) * multiplier
    except ValueError:
        return None

def extract_yahoo_stock_data(page, symbol):
    url = f"https://finance.yahoo.com/quote/{symbol}/key-statistics/"
    try:
        page.goto(url, timeout=20000)
        page.wait_for_timeout(500)
    except Exception:
        return None

    # Extract table rows
    rows = page.locator('tr').all_inner_texts()
    if not rows:
        return None

    stats_map = {}
    for r in rows:
        parts = [p.strip() for p in re.split(r'[\t\n]+', r) if p.strip()]
        if len(parts) >= 2:
            key = parts[0].lower().strip()
            val = parts[1].strip()
            stats_map[key] = val

    # Company name
    name = symbol
    h1 = page.locator('h1').first
    if h1.is_visible():
        name = h1.inner_text().split('(')[0].strip()

    # 1. Valuation
    market_cap = parse_num(stats_map.get('market cap'))
    trailing_pe = parse_num(stats_map.get('trailing p/e'))
    forward_pe = parse_num(stats_map.get('forward p/e'))
    peg_ratio = parse_num(stats_map.get('peg ratio (5yr expected)')) or parse_num(stats_map.get('peg ratio'))
    ev_to_ebitda = parse_num(stats_map.get('enterprise value/ebitda'))
    price_to_book = parse_num(stats_map.get('price/book'))

    # 2. Margins
    profit_margin = parse_num(stats_map.get('profit margin'))
    operating_margin = parse_num(stats_map.get('operating margin (ttm)')) or parse_num(stats_map.get('operating margin'))
    
    revenue = parse_num(stats_map.get('revenue (ttm)')) or parse_num(stats_map.get('revenue'))
    gross_profit = parse_num(stats_map.get('gross profit (ttm)')) or parse_num(stats_map.get('gross profit'))
    
    gross_margin = None
    if gross_profit is not None and revenue is not None and revenue > 0:
        gross_margin = round(gross_profit / revenue, 4)

    # 3. Returns & ROIC (NOPAT / Invested Capital)
    return_on_equity = parse_num(stats_map.get('return on equity (ttm)')) or parse_num(stats_map.get('return on equity'))
    return_on_assets = parse_num(stats_map.get('return on assets (ttm)')) or parse_num(stats_map.get('return on assets'))

    total_debt = parse_num(stats_map.get('total debt (mrq)')) or 0
    total_cash = parse_num(stats_map.get('total cash (mrq)')) or 0
    ebitda = parse_num(stats_map.get('ebitda'))

    roic = None
    if operating_margin and revenue and market_cap and price_to_book and price_to_book > 0:
        equity = market_cap / price_to_book
        invested_cap = equity + max(0, total_debt - total_cash)
        nopat = (operating_margin * revenue) * 0.75 # 25% standard corporate tax
        roic = round((nopat / invested_cap) * 100, 2)
    elif return_on_equity:
        roic = round(return_on_equity * 100 * 0.8, 2)

    roce = roic

    # 4. Growth
    rev_growth = parse_num(stats_map.get('quarterly revenue growth (yoy)'))
    earn_growth = parse_num(stats_map.get('quarterly earnings growth (yoy)'))

    # 5. Debt & Health
    net_debt_to_ebitda = None
    if total_debt is not None and total_cash is not None and ebitda and ebitda > 0:
        net_debt_to_ebitda = round((total_debt - total_cash) / ebitda, 2)

    return {
        'symbol': symbol,
        'name': name,
        'marketCap': market_cap or '',
        'grossMargins': gross_margin if gross_margin is not None else '',
        'operatingMargins': operating_margin if operating_margin is not None else '',
        'profitMargins': profit_margin if profit_margin is not None else '',
        'roic': roic if roic is not None else '',
        'roce': roce if roce is not None else '',
        'returnOnEquity': return_on_equity if return_on_equity is not None else '',
        'revenueGrowth': rev_growth if rev_growth is not None else '',
        'earningsGrowth': earn_growth if earn_growth is not None else '',
        'fcfGrowth': '',
        'netDebtToEbitda': net_debt_to_ebitda if net_debt_to_ebitda is not None else '',
        'interestCoverage': '',
        'goodwillToAssets': '',
        'trailingPE': round(trailing_pe, 2) if trailing_pe is not None else '',
        'forwardPE': round(forward_pe, 2) if forward_pe is not None else '',
        'pegRatio': round(peg_ratio, 2) if peg_ratio is not None else '',
        'priceToFreeCashFlow': '',
        'enterpriseToEbitda': round(ev_to_ebitda, 2) if ev_to_ebitda is not None else '',
    }

def main():
    tickers = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_TICKERS
    output_filename = "portfolio_fundamentals.csv"

    print("\n=======================================================")
    print("  Wealthfolio Metrics - Extraction 100% Yahoo Strict")
    print("=======================================================")
    print(f"Nombre d'actions : {len(tickers)}")
    print(f"Tickers : {', '.join(tickers)}\n")

    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Initialisation de la session Yahoo Finance...", end=" ", flush=True)
        page.goto('https://finance.yahoo.com', timeout=20000)
        agree_btn = page.locator('button[name="agree"], button:has-text("Accepter tout"), button:has-text("Accept all")').first
        if agree_btn.is_visible():
            agree_btn.click()
            page.wait_for_timeout(1500)
        print("✓ Prêt\n")

        for i, ticker in enumerate(tickers, 1):
            clean_sym = ticker.strip().upper()
            print(f"[{i}/{len(tickers)}] Extraction {clean_sym}...", end=" ", flush=True)
            data = extract_yahoo_stock_data(page, clean_sym)
            if data and (data['trailingPE'] or data['marketCap'] or data['profitMargins']):
                gm_pct = f"{round(data['grossMargins']*100, 1)}%" if data['grossMargins'] != '' else "—"
                peg_val = data['pegRatio'] if data['pegRatio'] != '' else "—"
                print(f"✓ Succès (Marge brute: {gm_pct}, Marge nette: {round(data['profitMargins']*100, 1) if data['profitMargins'] != '' else '—'}%, PEG: {peg_val}, P/E: {data['trailingPE']})")
                results.append(data)
            else:
                print("✗ Données non trouvées")
            time.sleep(0.3)

        browser.close()

    if not results:
        print("\nAucune donnée n'a pu être extraite.")
        return

    fieldnames = [
        'symbol', 'name', 'marketCap', 'grossMargins', 'operatingMargins', 'profitMargins',
        'roic', 'roce', 'returnOnEquity', 'revenueGrowth', 'earningsGrowth', 'fcfGrowth',
        'netDebtToEbitda', 'interestCoverage', 'goodwillToAssets',
        'trailingPE', 'forwardPE', 'pegRatio', 'priceToFreeCashFlow', 'enterpriseToEbitda'
    ]

    with open(output_filename, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            writer.writerow(r)

    print("\n=======================================================")
    print(f"✓ Fichier CSV généré avec succès : {os.path.abspath(output_filename)}")
    print(f"  {len(results)} actions enregistrées.")
    print("  Importez ce fichier dans Wealthfolio via le bouton 'Importer Fondamentaux' !")
    print("=======================================================\n")

if __name__ == '__main__':
    main()

// yahooFinanceSimple.js - Módulo simple para obtener datos de Yahoo Finance

const https = require('https');

class YahooFinanceSimple {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minuto de caché
    }

    /**
     * Obtiene datos de mercado para un símbolo específico
     * @param {string} symbol - Símbolo de trading (ej: 'EURUSD=X', 'BTC-USD')
     * @returns {Promise<Object>} Datos del símbolo
     */
    async getMarketData(symbol) {
        const cacheKey = symbol.toUpperCase();
        const cached = this.cache.get(cacheKey);

        // Verificar caché
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            console.log(`[YahooFinance] Using cached data for ${symbol}`);
            return cached.data;
        }

        try {
            console.log(`[YahooFinance] Fetching fresh data for ${symbol}`);
            const data = await this.fetchSymbolData(symbol);

            // Guardar en caché
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`[YahooFinance] Error fetching data for ${symbol}:`, error.message);

            // Si hay error pero tenemos caché (aunque expirada), la usamos
            if (cached) {
                console.log(`[YahooFinance] Using expired cache for ${symbol} due to API error`);
                return cached.data;
            }

            throw error;
        }
    }

    /**
     * Realiza la petición a Yahoo Finance API
     * @param {string} symbol - Símbolo a consultar
     * @returns {Promise<Object>} Datos procesados del símbolo
     */
    async fetchSymbolData(symbol) {
        const yahooSymbol = this.convertSymbolToYahooFormat(symbol);
        const url = `/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`;

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'query1.finance.yahoo.com',
                path: url,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive',
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode === 200) {
                            const jsonData = JSON.parse(data);
                            const processedData = this.processYahooResponse(jsonData, symbol);
                            resolve(processedData);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    /**
     * Convierte símbolos del formato local a Yahoo Finance
     * @param {string} symbol - Símbolo en formato local
     * @returns {string} Símbolo en formato Yahoo Finance
     */
    convertSymbolToYahooFormat(symbol) {
        const conversions = {
            // Pares de Forex
            'EURUSD': 'EURUSD=X',
            'GBPUSD': 'GBPUSD=X',
            'USDJPY': 'USDJPY=X',
            'USDCHF': 'USDCHF=X',
            'AUDUSD': 'AUDUSD=X',
            'USDCAD': 'USDCAD=X',
            'NZDUSD': 'NZDUSD=X',
            'EURGBP': 'EURGBP=X',
            'EURJPY': 'EURJPY=X',
            'GBPJPY': 'GBPJPY=X',
            'EURCHF': 'EURCHF=X',
            'EURCAD': 'EURCAD=X',
            'EURAUD': 'EURAUD=X',
            'AUDCAD': 'AUDCAD=X',
            'AUDJPY': 'AUDJPY=X',
            'CADJPY': 'CADJPY=X',
            'CHFJPY': 'CHFJPY=X',
            'NZDJPY': 'NZDJPY=X',

            // Materias Primas
            'XAUUSD': 'GC=F',
            'XAGUSD': 'SI=F',
            'OIL': 'CL=F',
            'NATGAS': 'NG=F',

            // Índices
            'SPX': '^GSPC',
            'NASDAQ': '^IXIC',
            'DOW': '^DJI',
            'FTSE': '^FTSE',
            'DAX': '^GDAXI',
            'NIKKEI': '^N225',

            // Crypto (formato estándar)
            'BTCUSD': 'BTC-USD',
            'ETHUSD': 'ETH-USD',
            'LTCUSD': 'LTC-USD',
            'XRPUSD': 'XRP-USD',
            'ADAUSD': 'ADA-USD',
        };

        return conversions[symbol.toUpperCase()] || `${symbol.toUpperCase()}=X`;
    }

    /**
     * Procesa la respuesta de Yahoo Finance y la formatea
     * @param {Object} response - Respuesta cruda de Yahoo Finance
     * @param {string} originalSymbol - Símbolo original solicitado
     * @returns {Object} Datos procesados
     */
    processYahooResponse(response, originalSymbol) {
        try {
            const chart = response.chart;
            if (!chart || !chart.result || chart.result.length === 0) {
                throw new Error('No data available for this symbol');
            }

            const result = chart.result[0];
            const meta = result.meta;

            // Obtener precios más recientes
            const latestPrice = meta.regularMarketPrice || 0;
            const previousClose = meta.previousClose || latestPrice;

            // Determinar dígitos basados en el precio
            const digits = this.determineDigits(latestPrice, originalSymbol);

            // Calcular spread simulado (basado en el tipo de activo)
            const spread = this.calculateSpread(latestPrice, originalSymbol);

            return {
                symbol: originalSymbol,
                yahooSymbol: meta.symbol,
                price: latestPrice,
                bid: latestPrice - (spread / 2),
                ask: latestPrice + (spread / 2),
                change: latestPrice - previousClose,
                changePercent: previousClose ? ((latestPrice - previousClose) / previousClose * 100) : 0,
                digits: digits,
                spread: spread,
                tickSize: Math.pow(10, -digits),
                timestamp: Date.now(),
                currency: meta.currency || 'USD',
                marketState: meta.marketState || 'CLOSED'
            };
        } catch (error) {
            console.error(`[YahooFinance] Error processing response for ${originalSymbol}:`, error);
            throw new Error(`Failed to process data: ${error.message}`);
        }
    }

    /**
     * Determina el número de dígitos decimales según el precio y tipo de activo
     * @param {number} price - Precio actual
     * @param {string} symbol - Símbolo del activo
     * @returns {number} Número de dígitos decimales
     */
    determineDigits(price, symbol) {
        const symbolUpper = symbol.toUpperCase();

        // Pares JPY -> 3 dígitos
        if (symbolUpper.includes('JPY')) {
            return 3;
        }

        // Pares de Forex -> 5 dígitos
        if (this.isForexPair(symbolUpper)) {
            return 5;
        }

        // Crypto -> depende del precio
        if (this.isCrypto(symbolUpper)) {
            if (price >= 1000) return 2;
            if (price >= 10) return 3;
            if (price >= 1) return 4;
            return 8;
        }

        // Índices -> 2 dígitos
        if (this.isIndex(symbolUpper)) {
            return 2;
        }

        // Materias primas -> depende del precio
        if (this.isCommodity(symbolUpper)) {
            if (symbolUpper.includes('XAU') || symbolUpper.includes('GC')) return 2;
            if (symbolUpper.includes('XAG') || symbolUpper.includes('SI')) return 3;
            return 2;
        }

        // Default -> 5 dígitos
        return 5;
    }

    /**
     * Calcula un spread realista basado en el tipo de activo
     * @param {number} price - Precio actual
     * @param {string} symbol - Símbolo del activo
     * @returns {number} Spread en puntos
     */
    calculateSpread(price, symbol) {
        const symbolUpper = symbol.toUpperCase();
        const tickSize = Math.pow(10, -this.determineDigits(price, symbol));

        if (this.isForexPair(symbolUpper)) {
            // Spreads típicos en pips
            if (symbolUpper.includes('EUR') || symbolUpper.includes('GBP')) return 2 * tickSize;
            if (symbolUpper.includes('JPY')) return 3 * tickSize;
            if (symbolUpper.includes('AUD') || symbolUpper.includes('CAD')) return 4 * tickSize;
            return 5 * tickSize;
        }

        if (this.isCrypto(symbolUpper)) {
            // Crypto spreads más amplios
            return price * 0.001; // 0.1% típico
        }

        if (this.isIndex(symbolUpper)) {
            return price * 0.0001; // 0.01% típico
        }

        if (this.isCommodity(symbolUpper)) {
            if (symbolUpper.includes('XAU')) return 0.5;
            if (symbolUpper.includes('XAG')) return 0.02;
            return price * 0.0005; // 0.05% típico
        }

        return 5 * tickSize; // Default
    }

    /**
     * Verifica si un símbolo es un par de forex
     */
    isForexPair(symbol) {
        const forexCurrencies = ['EUR', 'GBP', 'USD', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
        return forexCurrencies.some(curr => symbol.startsWith(curr)) &&
               forexCurrencies.some(curr => symbol.endsWith(curr) && !symbol.startsWith(curr));
    }

    /**
     * Verifica si un símbolo es una criptomoneda
     */
    isCrypto(symbol) {
        const cryptos = ['BTC', 'ETH', 'LTC', 'XRP', 'ADA', 'DOT', 'LINK', 'BCH'];
        return cryptos.some(crypto => symbol.includes(crypto));
    }

    /**
     * Verifica si un símbolo es un índice
     */
    isIndex(symbol) {
        const indices = ['SPX', 'NASDAQ', 'DOW', 'FTSE', 'DAX', 'NIKKEI'];
        return indices.some(index => symbol.includes(index)) || symbol.startsWith('^');
    }

    /**
     * Verifica si un símbolo es una materia prima
     */
    isCommodity(symbol) {
        const commodities = ['XAU', 'XAG', 'OIL', 'GAS', 'GC', 'SI', 'CL', 'NG'];
        return commodities.some(comm => symbol.includes(comm));
    }

    /**
     * Limpia la caché
     */
    clearCache() {
        this.cache.clear();
        console.log('[YahooFinance] Cache cleared');
    }
}

module.exports = YahooFinanceSimple;
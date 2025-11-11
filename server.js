require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Importar módulo Yahoo Finance
const YahooFinanceSimple = require('./yahooFinanceSimple');
const yahooFinance = new YahooFinanceSimple();

// Importar módulo de análisis unificado
let performUnifiedAnalysisFromBuffer = null;
try {
  ({ performUnifiedAnalysisFromBuffer } = require('./analisis_unificado'));
  console.log('[init] Módulo análisis_unificado cargado correctamente.');
} catch (e) {
  console.error('[init] ERROR: Módulo análisis_unificado no disponible:', e.message);
  console.error('[init] El análisis unificado es requerido para el funcionamiento completo.');
}

const app = express();

// Detección de entorno
const isProduction = process.env.NODE_ENV === 'production' || process.env.COOLIFY === 'true';
// Habilitar HTTPS local (true si no es producción y LOCAL_HTTPS o ENABLE_HTTPS están en true)
const isLocalHTTPS = !isProduction && (process.env.LOCAL_HTTPS === 'true' || process.env.ENABLE_HTTPS === 'true');

// Configuración según entorno
let config;
if (isProduction) {
  // Configuración para producción (Coolify)
  config = {
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    enableHTTPS: false,
    forceHTTPS: false,
    bindMessage: `Production server (Coolify) - HTTP only, binding to 0.0.0.0:${process.env.PORT || 3000}`
  };
  console.log('[env] 🏭 Production environment detected (Coolify)');
  console.log(`[env] ${config.bindMessage}`);
} else {
  // Configuración para desarrollo local
  config = {
    port: process.env.PORT || 3000,
    httpsPort: process.env.HTTPS_PORT || 3443,
    host: '0.0.0.0',  // <== Cambiado a 0.0.0.0 para escuchar en todas las interfaces (antes 'localhost')
    enableHTTPS: isLocalHTTPS,
    forceHTTPS: process.env.FORCE_HTTPS === 'true' && isLocalHTTPS,
    bindMessage: isLocalHTTPS
      ? `Local development with HTTPS enabled - HTTP on port ${process.env.PORT || 3000} (accessible via localhost or LAN), HTTPS on port ${process.env.HTTPS_PORT || 3443}`
      : `Local development - HTTP on port ${process.env.PORT || 3000} (accessible via localhost or LAN)`
  };
  console.log('[env] 💻 Local development environment detected');
  console.log(`[env] ${config.bindMessage}`);
  if (isLocalHTTPS) {
    console.log('[env] 🔒 Local HTTPS enabled via LOCAL_HTTPS=true');
  }
}

const STATIC_DIR = process.env.STATIC_DIR || '.';

// Rutas de certificados SSL (solo se usan en HTTPS local)
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || './ssl/server.key';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || './ssl/server.crt';
const SSL_CA_PATH = process.env.SSL_CA_PATH || './ssl/ca.crt';

// Middleware estáticos y CORS/JSON
app.use(express.static(STATIC_DIR));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de redirección a HTTPS (solo si forceHTTPS está habilitado)
if (config.forceHTTPS) {
  app.use((req, res, next) => {
    if (!req.secure) {
      // Skip redirect for non-localhost domains (allow local network access over HTTP)
      const host = req.hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        const httpsUrl = `https://${host}:${config.httpsPort}${req.url}`;
        console.log(`[redirect] HTTP to HTTPS: ${req.url} -> ${httpsUrl}`);
        return res.redirect(301, httpsUrl);
      }
      // Si el host no es localhost, no forzar redirección
    }
    next();
  });
}

// Función para cargar certificados SSL (solo HTTPS local)
function getSSLOptions() {
  if (!config.enableHTTPS) {
    return null;
  }
  try {
    const key = fs.readFileSync(SSL_KEY_PATH);
    const cert = fs.readFileSync(SSL_CERT_PATH);
    const ca = fs.existsSync(SSL_CA_PATH) ? fs.readFileSync(SSL_CA_PATH) : undefined;
    console.log('[ssl] SSL certificates loaded successfully');
    return {
      key: key,
      cert: cert,
      ca: ca,
      minVersion: 'TLSv1.2',
      secureOptions: crypto.constants.SSL_OP_NO_SSLv3 
                    | crypto.constants.SSL_OP_NO_TLSv1 
                    | crypto.constants.SSL_OP_NO_TLSv1_1
    };
  } catch (error) {
    console.error('[ssl] Error loading SSL certificates:', error.message);
    console.warn('[ssl] Falling back to HTTP only mode');
    return null;
  }
}

// Configuración de multer (subida de archivos en memoria)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // límite 25MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|webp|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// Inicializar Gemini AI (si hay API key)
let genAI = null;
let model = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite' });
    console.log('[init] Google Gemini AI initialized successfully');
  } catch (e) {
    console.error('[init] Error initializing Gemini AI:', e.message);
  }
} else {
  console.warn('[init] GEMINI_API_KEY not found in environment variables');
}

// Cargar datos de símbolos desde archivo JSON
function getSymbolsData() {
  try {
    const symbolsPath = path.join(__dirname, 'symbols.json');
    const symbolsData = fs.readFileSync(symbolsPath, 'utf8');
    return JSON.parse(symbolsData);
  } catch (error) {
    console.error('[init] Error loading symbols data:', error.message);
    return [];
  }
}

// Rutas API

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '3.2-Enhanced',
    environment: isProduction ? 'production' : 'development',
    https: config.enableHTTPS,
    host: config.host,
    port: config.port,
    features: {
      yahoo_finance: true,
      gemini_ai: !!model,
      unified_analysis: !!performUnifiedAnalysisFromBuffer,
      symbols_count: getSymbolsData().length
    }
  });
});

// Version info
app.get('/version', (req, res) => {
  res.json({
    version: '3.2-Enhanced',
    name: 'PlanScan Enhanced with Yahoo Finance Integration',
    description: 'AI-powered trading plan analysis with real-time market data',
    lastUpdate: '2025-10-24',
    environment: isProduction ? 'production' : 'development',
    features: [
      'Yahoo Finance API integration',
      'Real-time market data',
      'AI-powered image analysis',
      'Unified trading plan analysis',
      'Symbol validation',
      'Risk calculation',
      isProduction ? 'Production deployment (Coolify)' : 'Local development',
      config.enableHTTPS ? 'HTTPS support' : 'HTTP only'
    ]
  });
});

// Market data endpoint
app.get('/api/market-data/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    console.log(`[api] Requesting market data for ${symbol}`);
    try {
      const marketData = await yahooFinance.getMarketData(symbol);
      res.json(marketData);
    } catch (primaryError) {
      // Si falla símbolo primario, intentar con sinónimos comunes de crypto
      console.log(`[api] Primary symbol ${symbol} failed, trying fallback symbols`);
      let fallbackSymbol = null;
      const symbolLower = symbol.toLowerCase();
      if (symbolLower === 'bitcoin' || symbolLower === 'btc') {
        fallbackSymbol = 'BTC-USD';
      } else if (symbolLower === 'ethereum' || symbolLower === 'eth') {
        fallbackSymbol = 'ETH-USD';
      }
      if (fallbackSymbol) {
        console.log(`[api] Trying fallback symbol ${fallbackSymbol} for ${symbol}`);
        try {
          const fallbackData = await yahooFinance.getMarketData(fallbackSymbol);
          // Mapear de vuelta al símbolo original
          const mappedData = {
            ...fallbackData,
            symbol: symbolLower.includes('btc') ? 'BTCUSD' : 'ETHUSD',
            originalSymbol: symbol,
            fallbackUsed: true
          };
          res.json(mappedData);
          return;
        } catch (fallbackError) {
          console.log(`[api] Fallback symbol ${fallbackSymbol} also failed`);
        }
      }
      // Si todos los intentos fallan, propagar el error original
      throw primaryError;
    }
  } catch (error) {
    console.error(`[api] Error fetching market data for ${req.params.symbol}:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch market data',
      message: error.message,
      symbol: req.params.symbol
    });
  }
});

// Symbol validation endpoint
app.get('/api/symbol-validate/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const symbols = getSymbolsData();
    // Buscar símbolo en la base local
    const foundSymbol = symbols.find(s =>
      s.symbol.toLowerCase() === symbol.toLowerCase() ||
      s.name.toLowerCase().includes(symbol.toLowerCase())
    );
    if (foundSymbol) {
      // Intentar obtener datos de mercado en vivo
      try {
        const marketData = await yahooFinance.getMarketData(symbol);
        res.json({
          valid: true,
          symbol: foundSymbol,
          marketData: marketData,
          source: 'database+yahoo'
        });
      } catch (marketError) {
        res.json({
          valid: true,
          symbol: foundSymbol,
          marketData: null,
          source: 'database',
          warning: 'Market data unavailable'
        });
      }
    } else {
      res.json({
        valid: false,
        symbol: symbol,
        message: 'Symbol not found in database'
      });
    }
  } catch (error) {
    console.error(`[api] Error validating symbol ${req.params.symbol}:`, error.message);
    res.status(500).json({
      error: 'Failed to validate symbol',
      message: error.message
    });
  }
});

// Clear cache endpoint
app.post('/api/clear-cache', (req, res) => {
  try {
    yahooFinance.clearCache();
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('[api] Error clearing cache:', error.message);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

// Image analysis endpoint
app.post('/analyze', upload.single('tradingImage'), async (req, res) => {
  try {
    console.log('[api] Received image analysis request');
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    if (!performUnifiedAnalysisFromBuffer) {
      return res.status(503).json({
        error: 'Analysis service unavailable',
        message: 'Unified analysis module not loaded'
      });
    }
    // Obtener símbolo del cuerpo o nombre de archivo
    const selectedSymbol = req.body.selectedSymbol || req.body.symbol || req.file.originalname;
    const currentPrice = req.body.currentPrice ? parseFloat(req.body.currentPrice) : null;
    const volatilityData = req.body.volatilityData ? JSON.parse(req.body.volatilityData) : null;
    console.log('[api] Analysis parameters:', {
      symbol: selectedSymbol,
      filename: req.file.originalname,
      currentPrice: currentPrice,
      hasVolatilityData: !!volatilityData
    });
    // Ejecutar análisis unificado
    console.log('[api] Starting unified analysis...');
    const analysisResult = await performUnifiedAnalysisFromBuffer(
      req.file.buffer,
      selectedSymbol,
      req.file.originalname,
      currentPrice,
      volatilityData
    );
    console.log('[api] Analysis completed successfully');
    res.json(analysisResult);
  } catch (error) {
    console.error('[api] Error in image analysis:', error.message);
    res.status(500).json({ error: 'Analysis failed', message: error.message });
  }
});

// Alias para la ruta /analyze (misma funcionalidad)
app.post('/api/analyze', upload.single('tradingImage'), async (req, res) => {
  // Reutiliza la lógica de /analyze
  req.url = '/analyze';
  return app._router.handle(req, res);
});

// Symbols list endpoint
app.get('/api/symbols', (req, res) => {
  try {
    const symbols = getSymbolsData();
    const { category } = req.query;
    if (category) {
      const filtered = symbols.filter(s => s.category === category);
      res.json({ symbols: filtered, total: filtered.length, category: category });
    } else {
      res.json({ symbols: symbols, total: symbols.length });
    }
  } catch (error) {
    console.error('[api] Error fetching symbols:', error.message);
    res.status(500).json({ error: 'Failed to fetch symbols', message: error.message });
  }
});

// Search symbols endpoint
app.get('/api/symbols/search/:query', (req, res) => {
  try {
    const { query } = req.params;
    const symbols = getSymbolsData();
    const queryLower = query.toLowerCase();
    const results = symbols.filter(s =>
      s.symbol.toLowerCase().includes(queryLower) ||
      s.name.toLowerCase().includes(queryLower)
    ).slice(0, 10); // Máximo 10 resultados
    res.json({ query: query, symbols: results, total: results.length });
  } catch (error) {
    console.error('[api] Error searching symbols:', error.message);
    res.status(500).json({ error: 'Failed to search symbols', message: error.message });
  }
});

// Servir la aplicación frontend (archivo index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Middleware de manejo de errores
app.use((error, req, res, next) => {
  console.error('[server] Error:', error.message);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 25MB.' });
    }
  }
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Manejador 404 (ruta no encontrada)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`
  });
});

// Iniciar servidores HTTP/HTTPS según configuración
let httpServer = null;
let httpsServer = null;

// Iniciar servidor HTTP (siempre activo)
httpServer = http.createServer(app).listen(config.port, config.host, () => {
  if (isProduction) {
    console.log(`\n🚀 PlanScan v3.2 Enhanced - Production Server (Coolify)`);
    console.log(`🌐 HTTP Server: http://0.0.0.0:${config.port}`);
    console.log(`📍 Health check: http://0.0.0.0:${config.port}/health`);
    console.log(`📍 Version info: http://0.0.0.0:${config.port}/version`);
    console.log(`🔧 External SSL/TLS handled by Coolify/Traefik`);
  } else {
    const displayHost = config.host === '0.0.0.0' ? 'localhost' : config.host;  // Host para mostrar en logs
    console.log(`\n🚀 PlanScan v3.2 Enhanced - Local Development Server`);
    console.log(`🌐 HTTP Server: http://${displayHost}:${config.port}`);
    console.log(`📍 Health check: http://${displayHost}:${config.port}/health`);
    console.log(`📍 Version info: http://${displayHost}:${config.port}/version`);
  }
});

// Iniciar servidor HTTPS solo si está habilitado en desarrollo
if (config.enableHTTPS && !isProduction) {
  const sslOptions = getSSLOptions();
  if (sslOptions) {
    httpsServer = https.createServer(sslOptions, app).listen(config.httpsPort, config.host, () => {
      const displayHost = config.host === '0.0.0.0' ? 'localhost' : config.host;  // Host para mostrar en logs
      console.log(`🔒 HTTPS Server: https://${displayHost}:${config.httpsPort}`);
      console.log(`🔒 Health check: https://${displayHost}:${config.httpsPort}/health`);
      console.log(`🔒 Version info: https://${displayHost}:${config.httpsPort}/version`);
      console.log(`🔒 SSL/TLS enabled with minimum version TLS 1.2`);
    });
  } else {
    console.warn(`[server] Local HTTPS enabled but SSL certificates not found at:`);
    console.warn(`   Key: ${SSL_KEY_PATH}`);
    console.warn(`   Cert: ${SSL_CERT_PATH}`);
    console.warn(`   HTTPS server not started. Please install SSL certificates or set LOCAL_HTTPS=false.`);
  }
}

// Registro del estado del servidor después de un breve delay
setTimeout(() => {
  console.log(`\n📊 Features:`);
  console.log(`   ✅ Yahoo Finance API: ${yahooFinance ? 'Available' : 'Unavailable'}`);
  console.log(`   ✅ Gemini AI: ${model ? 'Available' : 'Unavailable'}`);
  console.log(`   ✅ Unified Analysis: ${performUnifiedAnalysisFromBuffer ? 'Available' : 'Unavailable'}`);
  console.log(`   📈 Symbols Database: ${getSymbolsData().length} symbols`);
  console.log(`   🌍 Environment: ${isProduction ? 'Production (Coolify)' : 'Local Development'}`);
  console.log(`   🔒 HTTPS: ${config.enableHTTPS ? (httpsServer ? 'Enabled (Local)' : 'Failed - SSL certs missing') : 'Disabled'}`);
  console.log(`   🔄 HTTPS Redirect: ${config.forceHTTPS ? 'Enabled (Local)' : 'Disabled'}`);
  console.log(`   🖥️  Binding: ${config.host}:${config.port}`);
  if (config.enableHTTPS && httpsServer) {
    console.log(`\n🌐 Both HTTP and HTTPS servers are running locally!`);
    console.log(`   HTTP:  http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
    console.log(`   HTTPS: https://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.httpsPort}`);
  } else if (isProduction) {
    console.log(`\n⚡ Ready for production use on Coolify!`);
    console.log(`   External SSL/TLS will be handled by Traefik proxy`);
  } else {
    console.log(`\n⚡ Local development server ready!`);
  }
  console.log();
}, 100);

// Apagado gracioso (graceful shutdown) en caso de señal de terminación
function gracefulShutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down gracefully...`);
  const shutdownPromises = [];
  if (httpServer) {
    shutdownPromises.push(new Promise((resolve) => {
      httpServer.close(() => {
        console.log('[server] HTTP server closed');
        resolve();
      });
    }));
  }
  if (httpsServer) {
    shutdownPromises.push(new Promise((resolve) => {
      httpsServer.close(() => {
        console.log('[server] HTTPS server closed');
        resolve();
      });
    }));
  }
  Promise.all(shutdownPromises).then(() => {
    console.log('[server] All servers closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

module.exports = app;

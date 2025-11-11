# PlanScan v3.2 Enhanced

AI-powered trading plan analysis with real-time market data and Yahoo Finance integration.

## Features

- **Real-Time Market Data**: Yahoo Finance API integration for live prices
- **AI Analysis**: Google Gemini 2.0 Flash for trading plan extraction from images
- **Symbol Validation**: 200+ trading symbols with fuzzy search
- **Risk Calculation**: Advanced risk management with broker-specific calculations
- **Export Options**: JSON and .set file generation for MetaTrader compatibility

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Google Gemini API key

### Installation

```bash
# Clone the repository
git clone https://github.com/Githolan/planscan-app.git
cd planscan-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start the server
npm start
```

### Environment Configuration

Create a `.env` file with:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=3000
STATIC_DIR=.
GEMINI_MODEL=gemini-2.0-flash-lite
```

## Usage

1. **Start the application**: Open http://localhost:3000
2. **Enter a trading symbol**: e.g., EURUSD, BTCUSD, XAUUSD
3. **Upload a trading plan image**: PNG, JPG, GIF, HEIC supported
4. **Analyze**: Click "Analyze Trading Plan" for AI-powered analysis
5. **Export**: Download results as JSON or .set file

## API Endpoints

### Health & Status
- `GET /health` - Server health check
- `GET /version` - Version and features information

### Market Data
- `GET /api/market-data/:symbol` - Real-time market data for symbol
- `GET /api/symbol-validate/:symbol` - Symbol validation with market data
- `POST /api/clear-cache` - Clear Yahoo Finance cache

### Symbol Database
- `GET /api/symbols` - List all available symbols
- `GET /api/symbols/search/:query` - Search symbols by name or symbol

### Analysis
- `POST /analyze` - Analyze trading plan image
- `POST /api/analyze` - Alias for analysis endpoint

## Architecture

- **Frontend**: Vanilla HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **AI Integration**: Google Gemini 2.0 Flash
- **Market Data**: Yahoo Finance API
- **File Handling**: Multer with memory storage

## Supported Symbols

- **Forex**: EURUSD, GBPUSD, USDJPY, etc.
- **Crypto**: BTCUSD, ETHUSD, etc.
- **Indices**: SPX, NASDAQ, DAX, etc.
- **Commodities**: XAUUSD, XAGUSD, OIL, etc.

## File Formats

### .set File Naming Convention
```
{Symbol}{Direction}{EntryType}{Behavior}{YYMMDDHHMMSS}.set
```

Example: `EURUSDLMS241019143000.set`

## Development

### Project Structure
```
├── index.html              # Main application frontend
├── server.js               # Express backend server
├── yahooFinanceSimple.js   # Yahoo Finance API integration
├── analisis_unificado.js   # Unified analysis module
├── symbols.json            # Symbol database (200+ symbols)
├── prompt_unificado_analisis.md  # AI prompt template
└── package.json            # Dependencies and scripts
```

### Scripts
```bash
npm start          # Start production server
npm run dev        # Start development server
```

## Production Deployment

### Docker Support

```dockerfile
# Build image
docker build -t planscan-enhanced .

# Run container
docker run -p 3000:3000 --env-file .env planscan-enhanced
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
GEMINI_API_KEY=your_production_key
GEMINI_MODEL=gemini-2.0-flash-lite
```

## Troubleshooting

### Common Issues

1. **Server won't start**
   - Check if `analisis_unificado.js` exists
   - Verify `GEMINI_API_KEY` in `.env`
   - Ensure Node.js version >= 18.0.0

2. **Market data not loading**
   - Check internet connection
   - Verify symbol format (e.g., EURUSD, BTCUSD)
   - Try clearing cache via `/api/clear-cache`

3. **Image analysis fails**
   - Verify `GEMINI_API_KEY` is valid
   - Check image format and size (max 25MB)
   - Ensure image contains clear trading plan

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm start

# Check API endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/market-data/EURUSD
```

## Performance

- **Yahoo Finance API cache**: 1 minute
- **Image processing**: Memory-based (no disk I/O)
- **Symbol search**: Optimized with debouncing
- **Response times**: <2 seconds for market data, <5 seconds for AI analysis

## Security

- API keys stored in environment variables only
- No sensitive data in frontend code
- HTTPS support for production deployments
- CORS enabled for development
- File uploads limited to 25MB

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the API documentation
- Open an issue on GitHub

---

**Version**: 3.2 Enhanced
**Status**: Production Ready
**Last Updated**: 2025-10-24
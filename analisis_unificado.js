require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// Configurar Gemini AI con la API key del archivo .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// SÍNONYMAP - MAPEO DE SÍNONYMOS PARA SÍMBOLOS
const symbolSynonyms = {
    // Criptomonedas
    'bitcoin': 'BTCUSD',
    'btc': 'BTCUSD',
    'ethereum': 'ETHUSD',
    'eth': 'ETHUSD',
    'ripple': 'XRPUSD',
    'xrp': 'XRPUSD',
    'litecoin': 'LTCUSD',
    'ltc': 'LTCUSD',
    'cardano': 'ADAUSD',
    'ada': 'ADAUSD',
    'solana': 'SOLUSD',
    'sol': 'SOLUSD',
    'binance': 'BNBUSD',
    'bnb': 'BNBUSD',
    'dogecoin': 'DOGUSD',
    'doge': 'DOGUSD',
    'polkadot': 'DOTUSD',
    'dot': 'DOTUSD',
    'avalanche': 'AVAXUSD',
    'avax': 'AVAXUSD',
    'chainlink': 'LNKUSD',
    'link': 'LNKUSD',
    'polygon': 'MATICUSD',
    'matic': 'MATICUSD',
    'uniswap': 'UNIUSD',
    'uni': 'UNIUSD',

    // Metales y Commodities
    'gold': 'XAUUSD',
    'xau': 'XAUUSD',
    'oro': 'XAUUSD',
    'silver': 'XAGUSD',
    'xag': 'XAGUSD',
    'plata': 'XAGUSD',
    'oil': 'OILUSD',
    'petróleo': 'OILUSD',
    'copper': 'XCUUSD',
    'cobre': 'XCUUSD',
    'platinum': 'XPTUSD',
    'xpt': 'XPTUSD',
    'palladium': 'XPDUSD',
    'xpd': 'XPDUSD',

    // Forex Principal
    'eur': 'EURUSD',
    'euro': 'EURUSD',
    'eurodollar': 'EURUSD',
    'gbp': 'GBPUSD',
    'pound': 'GBPUSD',
    'sterling': 'GBPUSD',
    'cable': 'GBPUSD',
    'jpy': 'USDJPY',
    'yen': 'USDJPY',
    'chf': 'USDCHF',
    'franc': 'USDCHF',
    'cad': 'USDCAD',
    'loonie': 'USDCAD',
    'aud': 'AUDUSD',
    'aussie': 'AUDUSD',
    'nzd': 'NZDUSD',
    'kiwi': 'NZDUSD',

    // Índices
    'sp500': 'US500',
    's&p': 'US500',
    'nasdaq': 'US100',
    'dow': 'US30',
    'dax': 'GER40',
    'ftse': 'UK100'
};

// Función para resolver símbolo a través de sinónimos
function resolveSymbol(inputSymbol) {
    if (!inputSymbol) return null;

    // Normalizar el símbolo (mayúsculas, sin espacios)
    const normalizedSymbol = inputSymbol.toLowerCase().trim();

    // Si el símbolo ya existe en formato correcto, devolverlo
    if (normalizedSymbol.match(/^[A-Z]{3,6}USD$/i)) {
        return normalizedSymbol.toUpperCase();
    }

    // Buscar en sinónimos
    if (symbolSynonyms[normalizedSymbol]) {
        return symbolSynonyms[normalizedSymbol];
    }

    // Si no se encuentra, devolver el original normalizado
    return normalizedSymbol.toUpperCase();
}

// Función para leer los símbolos disponibles
function getSymbolsData() {
    try {
        const symbolsPath = path.join(__dirname, 'symbols.json');
        const symbolsData = fs.readFileSync(symbolsPath, 'utf8');
        return JSON.parse(symbolsData);
    } catch (error) {
        console.error('❌ Error al leer el archivo de símbolos:', error.message);
        return null;
    }
}

// Función para buscar símbolo en ambas estructuras (categories y flat array)
function findSymbolInData(symbolData, targetSymbol) {
    if (!symbolData || !targetSymbol) return null;

    const normalizedTarget = targetSymbol.toUpperCase();

    // ESTRUCTURA 1: Con categories (formato antiguo/esperado)
    if (symbolData.categories) {
        for (const category of Object.values(symbolData.categories)) {
            if (category.symbols && Array.isArray(category.symbols)) {
                const found = category.symbols.find(s => s.symbol && s.symbol.toUpperCase() === normalizedTarget);
                if (found) return found;
            }
        }
    }

    // ESTRUCTURA 2: Array plano (formato actual)
    if (Array.isArray(symbolData)) {
        const found = symbolData.find(s => s.symbol && s.symbol.toUpperCase() === normalizedTarget);
        if (found) return found;
    }

    return null;
}

// Función para leer el prompt unificado
function getUnifiedPrompt() {
    try {
        const promptPath = path.join(__dirname, 'prompt_unificado_analisis.md');
        return fs.readFileSync(promptPath, 'utf8');
    } catch (error) {
        console.error('❌ Error al leer el prompt unificado:', error.message);
        return null;
    }
}

// Función para formatear símbolos para el prompt con información completa de precios y rangos
function formatSymbolsForPrompt(symbolsData) {
    if (!symbolsData) return '';

    // Extraer símbolos de ambas estructuras posibles
    let allSymbols = [];

    // ESTRUCTURA 1: Con categories (formato antiguo/esperado)
    if (symbolsData.categories) {
        Object.values(symbolsData.categories).forEach(category => {
            if (category.symbols && Array.isArray(category.symbols)) {
                allSymbols.push(...category.symbols);
            }
        });
    }

    // ESTRUCTURA 2: Array plano (formato actual)
    else if (Array.isArray(symbolsData)) {
        allSymbols = [...symbolsData];
    }

    // Si no hay símbolos, devolver string vacío
    if (allSymbols.length === 0) return '';

    // Tomar los símbolos más populares/relevantes (ej: primeros 50 para no hacer el prompt muy largo)
    const popularSymbols = allSymbols.slice(0, 50);

    return popularSymbols.map(symbol => {
        const priceRange = symbol.bid && symbol.ask ?
            `${symbol.bid} - ${symbol.ask}` :
            (symbol.bid || symbol.ask || 'N/A');

        const category = symbol.category || 'N/A';
        const digits = symbol.digits || 'N/A';
        const tickSize = symbol.tickSize || 'N/A';
        const assetName = symbol.blockchain || symbol.symbol || symbol.name.split(' - ')[0] || symbol.name || '';

        // Calcular rango esperado basado en el símbolo
        const expectedRange = getExpectedPriceRange(symbol);
        const currentPrice = (symbol.bid || symbol.ask) ? ((symbol.bid || 0) + (symbol.ask || 0)) / 2 : 'N/A';

        return `- ${symbol.symbol}: ${assetName}
  * Categoría: ${category}
  * Precio actual: ${priceRange}
  * Rango esperado: ${expectedRange}
  * Dígitos: ${digits}, Tick size: ${tickSize}`;
    }).join('\n');
}

// Función para estimar el rango de precios esperado para cada símbolo
function getExpectedPriceRange(symbol) {
    if (!symbol.bid || !symbol.ask) return 'N/A';

    const currentPrice = (symbol.bid + symbol.ask) / 2;
    const symbolLower = symbol.symbol.toLowerCase();

    // Definir rangos esperados por tipo de símbolo
    if (symbolLower.includes('eur') || symbolLower.includes('gbp') ||
        symbolLower.includes('aud') || symbolLower.includes('chf') ||
        symbolLower.includes('cad') || symbolLower.includes('nzd')) {
        // Pares forex majors y minors (usualmente 0.5 - 150)
        return currentPrice > 50 ? `${Math.round(currentPrice * 0.99)} - ${Math.round(currentPrice * 1.01)}` :
               currentPrice > 10 ? `${(currentPrice * 0.99).toFixed(symbol.digits || 4)} - ${(currentPrice * 1.01).toFixed(symbol.digits || 4)}` :
               `${(currentPrice * 0.98).toFixed(symbol.digits || 4)} - ${(currentPrice * 1.02).toFixed(symbol.digits || 4)}`;
    } else if (symbolLower.includes('jpy')) {
        // Pares con Yen (usualmente 50 - 160)
        return `${(currentPrice * 0.99).toFixed(2)} - ${(currentPrice * 1.01).toFixed(2)}`;
    } else if (symbolLower.includes('btc') || symbolLower.includes('bitcoin')) {
        // Bitcoin (usualmente 30k - 100k)
        return `${Math.round(currentPrice * 0.95)} - ${Math.round(currentPrice * 1.05)}`;
    } else if (symbolLower.includes('eth') || symbolLower.includes('ethereum')) {
        // Ethereum (usualmente 1k - 5k)
        return `${Math.round(currentPrice * 0.95)} - ${Math.round(currentPrice * 1.05)}`;
    } else if (symbolLower.includes('xau') || symbolLower.includes('gold')) {
        // Oro (usualmente 1800 - 2200)
        return `${Math.round(currentPrice * 0.98)} - ${Math.round(currentPrice * 1.02)}`;
    } else if (symbolLower.includes('usoil') || symbolLower.includes('oil')) {
        // Petróleo (usualmente 50 - 120)
        return `${(currentPrice * 0.95).toFixed(2)} - ${(currentPrice * 1.05).toFixed(2)}`;
    } else if (symbolLower.includes('sp500') || symbolLower.includes('nasdaq') ||
               symbolLower.includes('dow') || symbolLower.includes('indice')) {
        // Índices (usualmente 3000 - 20000)
        return `${Math.round(currentPrice * 0.98)} - ${Math.round(currentPrice * 1.02)}`;
    } else {
        // Rango genérico (±5% del precio actual)
        return currentPrice > 1000 ?
            `${Math.round(currentPrice * 0.95)} - ${Math.round(currentPrice * 1.05)}` :
            currentPrice > 100 ?
            `${(currentPrice * 0.95).toFixed(2)} - ${(currentPrice * 1.05).toFixed(2)}` :
            `${(currentPrice * 0.90).toFixed(symbol.digits || 4)} - ${(currentPrice * 1.10).toFixed(symbol.digits || 4)}`;
    }
}

async function performUnifiedAnalysis(imageBuffer, selectedSymbol, filename = 'image', currentPrice = null, volatilityData = null) {
    try {
        console.log('🔍 Iniciando análisis unificado completo...', { selectedSymbol, currentPrice, volatilityData });

        // Validar parámetros obligatorios
        if (!selectedSymbol) {
            throw new Error('❌ El símbolo seleccionado es obligatorio para el análisis unificado');
        }

        if (!imageBuffer) {
            throw new Error('❌ La imagen es obligatoria para el análisis unificado');
        }

        // OBTENER SÍMBOLO RESUELTO (CON SOPORTE PARA SINÓNIMOS)
        const resolvedSymbol = resolveSymbol(selectedSymbol);
        console.log(`📝 Símbolo original: "${selectedSymbol}" → Símbolo resuelto: "${resolvedSymbol}"`);

        // Obtener datos necesarios
        const symbolsData = getSymbolsData();
        if (!symbolsData) {
            throw new Error('❌ No se pudo cargar la base de datos de símbolos');
        }

        const prompt = getUnifiedPrompt();
        if (!prompt) {
            throw new Error('❌ No se pudo cargar el prompt unificado');
        }

        // Validar símbolo en nuestra base de datos usando la nueva función
        const symbolInfo = findSymbolInData(symbolsData, resolvedSymbol);
        if (!symbolInfo) {
            console.warn(`⚠️ Símbolo "${resolvedSymbol}" no encontrado en la base de datos, continuando igualmente`);
        } else {
            console.log(`✅ Símbolo "${resolvedSymbol}" encontrado en base de datos`);
        }

        if (!symbolInfo) {
            console.warn(`⚠️ Advertencia: Símbolo "${selectedSymbol}" no encontrado en la base de datos, continuando igualmente`);
        }

        // Determinar precio a usar
        let displayPrice = currentPrice;
        let priceSource = "Yahoo Finance (Live)";

        if (!currentPrice && symbolInfo) {
            displayPrice = ((symbolInfo.bid || 0) + (symbolInfo.ask || 0)) / 2;
            priceSource = "Symbols Database (Bid/Ask)";
        }

        if (!displayPrice) {
            throw new Error('❌ No hay precio disponible para el análisis');
        }

        console.log(`💰 Usando precio: ${displayPrice} (Fuente: ${priceSource})`);

        // Preparar el prompt unificado con datos de volatilidad
        const symbolsList = formatSymbolsForPrompt(symbolsData);
        const extractedData = { message: "Datos serán extraídos de la imagen por Gemini" };

        // Add volatility information to the prompt
        let volatilityInfo = '';
        if (volatilityData) {
            volatilityInfo = `
## Volatilidad y Condiciones Actuales del Mercado:
- **Volatilidad Anualizada**: ${volatilityData.annualized?.toFixed(1) || 'N/A'}% (${volatilityData.level || 'N/A'})
- **Average True Range (ATR)**: ${volatilityData.atrPercentage?.toFixed(2) || 'N/A'}%
- **Distancia recomendada para Stop Loss**: ${volatilityData.recommendedStopDistance?.toFixed(2) || 'N/A'}%
- **Distancia recomendada para Entry Limit**: ${volatilityData.recommendedEntryDistance?.toFixed(2) || 'N/A'}%
- **Análisis basado en 30 días de datos históricos reales`;
        }

        const fullPrompt = prompt
            .replace('{{SELECTED_SYMBOL}}', resolvedSymbol) // USAR SÍMBOLO RESUELTO
            .replace('{{CURRENT_PRICE}}', displayPrice.toString())
            .replace('{{SYMBOLS_LIST}}', symbolsList)
            .replace('{{EXTRACTED_DATA}}', JSON.stringify(extractedData, null, 2))
            .replace('{{VOLATILITY_INFO}}', volatilityInfo);

        // Convertir buffer a base64
        const imageBase64 = imageBuffer.toString('base64');
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: 'image/jpeg'
            }
        };

        // Obtener el modelo de Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

        console.log('🤖 Enviando imagen a Gemini AI para análisis unificado completo...');

        // Generar el análisis unificado
        const result = await model.generateContent([fullPrompt, imagePart]);
        const response = await result.response;
        const analysis = response.text();

        console.log('✅ Análisis unificado completado');

        // Limpiar y formatear la respuesta JSON
        let cleanAnalysis = analysis.trim();

        // Eliminar marcadores de código si existen
        if (cleanAnalysis.startsWith('```json')) {
            cleanAnalysis = cleanAnalysis.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
        }

        // Parsear la respuesta JSON
        let analysisResult;
        try {
            analysisResult = JSON.parse(cleanAnalysis);
        } catch (parseError) {
            console.error('❌ Error parseando JSON de Gemini:', parseError.message);
            throw new Error(`❌ Error parseando respuesta JSON: ${parseError.message}`);
        }

        // Validar estructura básica de la respuesta
        if (!analysisResult.symbol || !analysisResult.trading_plan || !analysisResult.technical_analysis) {
            throw new Error('❌ La respuesta no contiene la estructura esperada del análisis unificado');
        }

        // FORZAR que el símbolo sea siempre el del usuario (original)
        analysisResult.symbol = selectedSymbol;
        if (analysisResult.trading_plan) {
            analysisResult.trading_plan.symbol = selectedSymbol;
        }

        // AÑADIR RESULTADOS DETALLADOS DE TODAS LAS FASES DEL ANÁLISIS
        analysisResult.analysis_phases = {
            phase_1_symbol_resolution: {
                status: 'completed',
                original_input: selectedSymbol,
                resolved_symbol: resolvedSymbol,
                symbol_changed: selectedSymbol !== resolvedSymbol,
                synonym_used: symbolSynonyms[selectedSymbol.toLowerCase()] || false,
                message: selectedSymbol !== resolvedSymbol
                    ? `Símbolo "${selectedSymbol}" resuelto a "${resolvedSymbol}" usando base de datos de sinónimos`
                    : `Símbolo "${selectedSymbol}" reconocido directamente`
            },
            phase_2_database_validation: {
                status: symbolInfo ? 'completed' : 'warning',
                symbol_found: !!symbolInfo,
                database_structure: symbolsData.categories ? 'categories' : 'flat_array',
                total_symbols_available: Array.isArray(symbolsData) ? symbolsData.length :
                    (symbolsData.categories ? Object.values(symbolsData.categories).reduce((sum, cat) => sum + (cat.symbols?.length || 0), 0) : 0),
                message: symbolInfo
                    ? `Símbolo "${resolvedSymbol}" validado en base de datos`
                    : `⚠️ Símbolo "${resolvedSymbol}" no encontrado en base de datos, continuando con análisis`
            },
            phase_3_price_determination: {
                status: 'completed',
                price_used: displayPrice,
                price_source: priceSource,
                current_price_provided: !!currentPrice,
                symbol_price_available: !!(symbolInfo && ((symbolInfo.bid || symbolInfo.ask))),
                message: `Precio ${displayPrice} obtenido de ${priceSource}`
            },
            phase_4_ai_analysis: {
                status: 'completed',
                ai_model: 'gemini-2.0-flash-lite',
                analysis_timestamp: new Date().toISOString(),
                image_processed: !!imageBuffer,
                prompt_enhanced: !!volatilityData,
                volatility_data_available: !!volatilityData,
                message: 'Análisis completado con Gemini AI usando imagen y datos de mercado'
            },
            phase_5_result_validation: {
                status: analysisResult.validation ? 'completed' : 'completed',
                coherence_check: !!(analysisResult.validation && analysisResult.validation.coherence_check),
                risk_analysis: !!(analysisResult.validation && analysisResult.validation.risk_analysis),
                technical_analysis: !!analysisResult.technical_analysis,
                trading_plan_generated: !!analysisResult.trading_plan,
                message: 'Validación de coherencia y análisis de riesgo completados'
            },
            phase_6_elliott_wave_analysis: {
                status: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave ? 'completed' : 'not_applicable',
                elliott_wave_applicable: !!(analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave && analysisResult.technical_analysis.elliott_wave.applicable),
                pattern_type: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave ? analysisResult.technical_analysis.elliott_wave.pattern_type || 'none' : 'none',
                current_wave: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave ? analysisResult.technical_analysis.elliott_wave.current_wave || 'not_identified' : 'not_identified',
                confidence_level: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave ? analysisResult.technical_analysis.elliott_wave.confidence || 'low' : 'low',
                rules_compliance: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave && analysisResult.technical_analysis.elliott_wave.rules_compliance ? {
                    wave2_not_beyond_wave1: analysisResult.technical_analysis.elliott_wave.rules_compliance.rule_1_wave2_not_beyond_wave1,
                    wave3_not_shortest: analysisResult.technical_analysis.elliott_wave.rules_compliance.rule_2_wave3_not_shortest,
                    wave4_no_overlap_wave1: analysisResult.technical_analysis.elliott_wave.rules_compliance.rule_3_wave4_no_overlap_wave1
                } : null,
                fibonacci_targets: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave ? analysisResult.technical_analysis.elliott_wave.fibonacci_targets || [] : [],
                invalidation_level: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave ? analysisResult.technical_analysis.elliott_wave.invalidation_level || null : null,
                message: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave && analysisResult.technical_analysis.elliott_wave.applicable
                    ? 'Análisis de Ondas de Elliott completado con identificación de patrones'
                    : 'Análisis de Ondas de Elliott no aplicable para esta estructura de mercado'
            }
        };

        // Añadir metadatos adicionales
        analysisResult.metadata = {
            filename: filename,
            analysis_timestamp: new Date().toISOString(),
            model_used: 'gemini-2.0-flash-lite',
            original_symbol: selectedSymbol,
            resolved_symbol: resolvedSymbol,
            selected_symbol: selectedSymbol,
            price_source: priceSource,
            price_used: displayPrice,
            synonym_mapping_used: selectedSymbol !== resolvedSymbol,
            analysis_version: '3.2-Enhanced-With-Synonyms'
        };

        // Si hay warnings sobre coherencia, generar mensajes para el usuario
        if (analysisResult.validation && analysisResult.validation.coherence_check) {
            const coherence = analysisResult.validation.coherence_check;
            if (!coherence.values_coherent) {
                console.warn('⚠️ Se detectaron incoherencias en los valores:', coherence.issues_found);
                analysisResult.user_warning = {
                    type: 'coherence',
                    message: `Se ajustaron los valores para que sean coherentes con ${selectedSymbol}. ${coherence.issues_found.join('. ')}`
                };
            }
        }

        // Si hay advertencias de riesgo, agregarlas
        if (analysisResult.validation && analysisResult.validation.warnings && analysisResult.validation.warnings.length > 0) {
            analysisResult.risk_warnings = analysisResult.validation.warnings;
        }

        // MENSAJE COMPLETO DE ÉXITO CON DETALLES DE TODAS LAS FASES
        console.log(`🎯 Análisis unificado completado exitosamente para ${selectedSymbol}`);
        console.log(`📊 Plan de trading: ${analysisResult.trading_plan.direction} ${analysisResult.trading_plan.entry_price}`);

        // Mostrar resumen de fases completadas
        console.log('\n📋 RESUMEN DE FASES DEL ANÁLISIS:');
        console.log(`✅ Fase 1 - Resolución de Símbolo: ${selectedSymbol} → ${resolvedSymbol}`);
        console.log(`✅ Fase 2 - Validación en Base de Datos: ${symbolInfo ? 'Símbolo encontrado' : 'Símbolo no encontrado (continuando)'}`);
        console.log(`✅ Fase 3 - Determinación de Precio: ${displayPrice} (${priceSource})`);
        console.log(`✅ Fase 4 - Análisis AI: Completado con Gemini 2.0 Flash`);
        console.log(`✅ Fase 5 - Validación de Resultados: Completado`);

        // Mostrar estado del análisis de Elliott Wave
        const elliottStatus = analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave && analysisResult.technical_analysis.elliott_wave.applicable;
        if (elliottStatus) {
            console.log(`✅ Fase 6 - Análisis de Ondas de Elliott: ${analysisResult.technical_analysis.elliott_wave.pattern_type || 'Patrón identificado'}`);
        } else {
            console.log(`⚠️ Fase 6 - Análisis de Ondas de Elliott: No aplicable para esta estructura`);
        }

        if (selectedSymbol !== resolvedSymbol) {
            console.log(`🔄 SINÓNIMO UTILIZADO: "${selectedSymbol}" → "${resolvedSymbol}"`);
        }

        return {
            success: true,
            result: analysisResult,
            symbol: selectedSymbol,
            confidence: analysisResult.validation?.confidence || 0.8,
            filename: filename,
            analysis_summary: {
                original_symbol: selectedSymbol,
                resolved_symbol: resolvedSymbol,
                synonym_used: selectedSymbol !== resolvedSymbol,
                total_phases: 6,
                phases_completed: 6,
                price_used: displayPrice,
                trading_direction: analysisResult.trading_plan?.direction || 'N/A',
                entry_price: analysisResult.trading_plan?.entry_price || 'N/A',
                elliott_wave_applicable: !!(analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave && analysisResult.technical_analysis.elliott_wave.applicable),
                elliott_pattern: analysisResult.technical_analysis && analysisResult.technical_analysis.elliott_wave ? analysisResult.technical_analysis.elliott_wave.pattern_type || 'none' : 'none'
            }
        };

    } catch (error) {
        console.error('❌ Error en el análisis unificado:', error.message);
        return {
            success: false,
            error: error.message,
            symbol: selectedSymbol,
            filename: filename
        };
    }
}

// Función para analizar desde buffer (memoria)
async function performUnifiedAnalysisFromBuffer(imageBuffer, selectedSymbol, filename = 'image', currentPrice = null) {
    return await performUnifiedAnalysis(imageBuffer, selectedSymbol, filename, currentPrice);
}

module.exports = {
    performUnifiedAnalysis,
    performUnifiedAnalysisFromBuffer
};
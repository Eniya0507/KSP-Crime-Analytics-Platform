'use strict';
/**
 * Catalyst Function: ksp-ai-query
 * Handles AI chatbot queries with RAG pipeline.
 * In production, this calls Llama 3.1 8B via Catalyst AI or an external LLM endpoint.
 * For the hackathon demo, it returns structured responses based on query patterns.
 */

const catalyst = require('zcatalyst-sdk-node');

module.exports = {
  async handler(context, basicIO) {
    const app = catalyst.initialize(context);
    const body = JSON.parse(basicIO.getRequest().body || '{}');
    const { query, lang = 'en', history = [] } = body;

    if (!query) {
      basicIO.getResponse().setStatusCode(400);
      basicIO.getResponse().setBody(JSON.stringify({ error: 'query is required' }));
      return;
    }

    // Cache check
    const cache = app.cache();
    const cacheKey = `ksp:ai:${Buffer.from(query).toString('base64').slice(0, 32)}`;
    try {
      const cached = await cache.getValue(cacheKey);
      if (cached) {
        basicIO.getResponse().setBody(cached);
        return;
      }
    } catch (_) { /* cache miss */ }

    // Log audit
    const datastore = app.datastore();
    const auditTable = datastore.table('ksp_audit_log');
    await auditTable.insertRow({
      user_id: body.userId || 'anonymous',
      user_name: body.userName || 'Anonymous',
      action: `AI query: ${query.slice(0, 60)}`,
      category: 'AI Query',
      detail: `Lang: ${lang}`,
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    // Response (in production: call LLM endpoint)
    const response = {
      content: `[Catalyst Function] Query received: "${query}". In production, this calls Llama 3.1 8B with RAG over the KSP crime database.`,
      confidence: 0.85,
      sources: [],
      lang,
    };

    const responseStr = JSON.stringify(response);
    await cache.setValue(cacheKey, responseStr, 300).catch(() => {});
    basicIO.getResponse().setBody(responseStr);
  },
};

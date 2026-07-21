'use strict';
/**
 * Catalyst Cron Function: ksp-alerts-cron
 * Runs daily at 6 AM IST to generate crime alerts from the database.
 * Writes new alerts to Catalyst Data Store and sends Signals for real-time push.
 */

const catalyst = require('zcatalyst-sdk-node');

module.exports = {
  async handler(context, basicIO) {
    const app = catalyst.initialize(context);
    const datastore = app.datastore();
    const alertsTable = datastore.table('ksp_alerts');
    const signals = app.signals();

    // In production: query Supabase/DataStore for recent high-severity unsolved cases
    // and generate alerts. For demo, we create a sample alert.
    const alert = {
      severity: 'high',
      title: 'Daily Crime Intelligence Summary',
      message: `Automated daily alert generated at ${new Date().toLocaleString('en-IN')}. Review hotspot districts.`,
      district_id: 'BLR',
      category: 'Hotspot',
      dismissed: false,
    };

    await alertsTable.insertRow(alert).catch((e) => console.error('Alert insert error:', e));

    // Publish real-time signal
    await signals.publish('ksp-critical-alerts', JSON.stringify(alert)).catch((e) => console.error('Signal error:', e));

    basicIO.getResponse().setBody(JSON.stringify({ status: 'ok', alert }));
  },
};

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://hrp:hrp_dev@127.0.0.1:5432/hrp',
});
const q = `SELECT table_name, column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' ORDER BY table_name, ordinal_position`;
pool.query(q, (err, res) => {
  if (err) {
    console.log('ERR', err.message);
  } else {
    let last = '';
    for (const r of res.rows) {
      if (r.table_name !== last) {
        console.log('\n== ' + r.table_name + ' ==');
        last = r.table_name;
      }
      console.log('  ' + r.column_name + ' : ' + r.data_type);
    }
  }
  pool.end();
});

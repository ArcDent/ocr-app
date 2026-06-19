const m = require('uuid');
console.log('uuid type:', typeof m);
console.log('v4 type:', typeof m.v4);
console.log('frozen:', Object.isFrozen(m));
try { m.v4 = 'x'; console.log('assign OK'); } catch(e){ console.log('assign ERR:', e.message); }

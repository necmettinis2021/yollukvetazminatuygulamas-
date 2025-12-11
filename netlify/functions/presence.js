// Netlify Blob Storage ile Çevrimiçi Sayacı (Ekstra kayıt gerektirmez!)
const { getStore } = require('@netlify/blobs');

const TIMEOUT = 60000; // 20 saniye sonra kullanıcı offline sayılır

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const action = params.action || 'get';
  const userId = params.uid;

  try {
    const store = getStore({ name: 'presence', siteID: context.site.id, token: context.clientContext?.identity?.token });
    
    const now = Date.now();
    
    // Mevcut kullanıcı listesini al
    let users = {};
    try {
      const data = await store.get('users', { type: 'json' });
      if (data) users = data;
    } catch (e) {
      users = {};
    }
    
    // Eski kullanıcıları temizle
    const activeUsers = {};
    for (const [id, timestamp] of Object.entries(users)) {
      if (now - timestamp < TIMEOUT) {
        activeUsers[id] = timestamp;
      }
    }
    
    // Aksiyona göre işlem yap
    if ((action === 'heartbeat' || action === 'inc') && userId) {
      activeUsers[userId] = now;
    }
    
    if ((action === 'dec' || action === 'leave') && userId) {
      delete activeUsers[userId];
    }
    
    // Kaydet
    await store.setJSON('users', activeUsers);
    
    const count = Math.max(1, Object.keys(activeUsers).length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ count, userId }),
    };
  } catch (error) {
    console.error('Presence error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ count: 1, error: error.message }),
    };
  }
};

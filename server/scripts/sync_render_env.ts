import dotenv from 'dotenv';
dotenv.config();

const RENDER_API_KEY = process.argv[2] || process.env.RENDER_API_KEY;

if (!RENDER_API_KEY) {
  console.error('❌ Missing Render API Key.');
  console.log('Usage: npx tsx server/scripts/sync_render_env.ts <RENDER_API_KEY>');
  console.log('You can get your Render API Key from: https://dashboard.render.com/u/settings#api-keys');
  process.exit(1);
}

const envVars = [
  {
    key: 'DATABASE_URL',
    value: 'postgresql://neondb_owner:npg_9sCNYmzVL8iO@ep-sparkling-star-b5rtglfq-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  },
  {
    key: 'TELEGRAM_BOT_TOKEN',
    value: '8736053891:AAHCNqXA-1DZIJA5ylb-oYw1EAEkHfX9Xjc'
  },
  {
    key: 'TELEGRAM_BOT_USERNAME',
    value: 'sonicbingobot'
  },
  {
    key: 'TELEGRAM_CHANNEL_ID',
    value: '@sonicbingo'
  },
  {
    key: 'TELEGRAM_WEBAPP_URL',
    value: 'https://sonic-bingo.asoeyo029.workers.dev'
  },
  {
    key: 'CLOUDFLARE_FRONTEND_URL',
    value: 'https://sonic-bingo.asoeyo029.workers.dev'
  },
  {
    key: 'VITE_BACKEND_URL',
    value: 'https://sonic-bingo.onrender.com'
  },
  {
    key: 'NODE_ENV',
    value: 'production'
  },
  {
    key: 'PORT',
    value: '5000'
  },
  {
    key: 'CORS_ORIGIN',
    value: '*'
  },
  {
    key: 'ADMIN_PIN',
    value: '1234'
  },
  {
    key: 'JWT_SECRET',
    value: 'sonic_bingo_super_secret_production_key_2026_et'
  }
];

async function syncRender() {
  console.log('🚀 Connecting to Render API...');
  
  // 1. List services to find sonic-bingo
  const listRes = await fetch('https://api.render.com/v1/services?limit=20', {
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY.trim()}`,
      'Accept': 'application/json'
    }
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    console.error(`❌ Render API Error (${listRes.status}):`, errText);
    process.exit(1);
  }

  const services = await listRes.json();
  const serviceItem = services.find((s: any) => {
    const name = s.service?.name?.toLowerCase();
    const slug = s.service?.slug?.toLowerCase();
    return name === 'sonic-bingo' || slug === 'sonic-bingo' || name?.includes('sonic-bingo');
  }) || services[0];

  if (!serviceItem || !serviceItem.service) {
    console.error('❌ Could not find service on Render. Available services:', services.map((s: any) => s.service?.name));
    process.exit(1);
  }

  const serviceId = serviceItem.service.id;
  const serviceName = serviceItem.service.name;
  console.log(`✓ Found Render Service: ${serviceName} (ID: ${serviceId})`);

  // 2. PUT env vars
  console.log(`Setting ${envVars.length} environment variables on ${serviceName}...`);
  const putRes = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY.trim()}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(envVars)
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    console.error(`❌ Failed to update env vars (${putRes.status}):`, errText);
    process.exit(1);
  }

  const result = await putRes.json();
  console.log('🎉 Successfully updated environment variables on Render!');
  console.log(`   Configured ${result.length} variables. Render is automatically redeploying now.`);
}

syncRender().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

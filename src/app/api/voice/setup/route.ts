import { NextRequest, NextResponse } from 'next/server';

/**
 * GET/POST /api/voice/setup
 * Creates the PayBuddy agent on ElevenLabs with a warm Dutch voice.
 * Returns the agent_id to set as ELEVENLABS_AGENT_ID env var.
 * Protected — requires CRON_SECRET.
 */
async function handleSetup(req: NextRequest) {
  // Admin only — requires CRON_SECRET
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  if (auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not set' }, { status: 500 });

  if (process.env.ELEVENLABS_AGENT_ID) {
    return NextResponse.json({
      message: 'Agent already configured',
      agent_id: process.env.ELEVENLABS_AGENT_ID,
    });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        name: 'PayBuddy',
        conversation_config: {
          agent: {
            prompt: {
              prompt: 'Je bent PayBuddy, de persoonlijke financiele assistent in PayWatch. Je helpt Nederlandse huishoudens met rekeningen en schulden. Spreek Nederlands tenzij anders gevraagd. Wees warm, direct en empathisch. Gebruik informeel je/jij. Nooit em-dashes. Nooit juridisch advies geven. Houd antwoorden kort en persoonlijk, als een WhatsApp gesprek met een slimme vriend.',
            },
            first_message: 'Hoi! Ik ben PayBuddy, je persoonlijke financiele maat. Waar kan ik je mee helpen?',
            language: 'nl',
          },
          tts: {
            voice_id: 'pNInz6obpgDQGcFmaJgB',
            model_id: 'eleven_flash_v2_5',
          },
        },
        platform_settings: {
          auth: {
            enable_auth: true,
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs create agent error:', err);
      return NextResponse.json({ error: 'Failed to create agent', details: err }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      agent_id: data.agent_id,
      instructions: 'Set ELEVENLABS_AGENT_ID=' + data.agent_id + ' in Vercel environment variables, then redeploy.',
    });
  } catch (error) {
    console.error('Voice setup error:', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handleSetup(req); }
export async function POST(req: NextRequest) { return handleSetup(req); }

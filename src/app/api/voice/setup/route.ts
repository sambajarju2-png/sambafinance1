import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/voice/setup
 * One-time setup: creates the PayBuddy agent on ElevenLabs.
 * Returns the agent_id to set as ELEVENLABS_AGENT_ID env var.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not set' }, { status: 500 });

  // Check if agent already exists
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
              prompt: 'Je bent PayBuddy, de persoonlijke financiele assistent in PayWatch. Je helpt Nederlandse huishoudens met rekeningen en schulden. Spreek Nederlands tenzij anders gevraagd. Wees warm, direct en empathisch. Gebruik informeel je/jij. Nooit em-dashes. Nooit juridisch advies geven.',
            },
            first_message: 'Hoi! Ik ben PayBuddy, je persoonlijke financiele maat. Waar kan ik je mee helpen?',
            language: 'nl',
          },
          tts: {
            voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam - clear male voice
          },
        },
        platform_settings: {
          auth: {
            enable_auth: true, // Require signed URLs
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
    const agentId = data.agent_id;

    return NextResponse.json({
      success: true,
      agent_id: agentId,
      instructions: `Set ELEVENLABS_AGENT_ID=${agentId} in your Vercel environment variables`,
    });
  } catch (error) {
    console.error('Voice setup error:', error);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}

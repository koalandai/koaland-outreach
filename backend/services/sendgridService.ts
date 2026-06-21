import sgMail from '@sendgrid/mail';

let initialized = false;

function init() {
  if (!initialized) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
    initialized = true;
  }
}

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  customArgs?: Record<string, string>;
  campaignId?: string;
}

export interface SendEmailResult {
  sendgridMessageId: string;
  status: 'sent';
}

function convertToHtml(text: string): string {
  return text
    .split('\n')
    .map(line => {
      if (line.trim() === '') return '<br>';
      if (line.startsWith('http')) return `<a href="${line}">${line}</a>`;
      return `<p style="margin:0 0 8px 0;line-height:1.6;">${line}</p>`;
    })
    .join('\n');
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  init();

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || '';
  const fromName = process.env.SENDGRID_FROM_NAME || 'Murat';

  if (!fromEmail) throw new Error('SENDGRID_FROM_EMAIL not configured');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: Georgia, serif; font-size: 15px; color: #2C2417; background: #fff; margin: 0; padding: 20px; }
  .container { max-width: 580px; margin: 0 auto; }
  p { margin: 0 0 12px 0; line-height: 1.7; }
  a { color: #315C46; }
  .sig { margin-top: 32px; color: #6B5F4E; font-size: 14px; }
</style>
</head>
<body>
<div class="container">
${convertToHtml(params.htmlBody)}
</div>
</body>
</html>`;

  const msg: any = {
    to: params.to,
    from: { email: fromEmail, name: fromName },
    subject: params.subject,
    text: params.textBody,
    html: htmlContent,
    trackingSettings: {
      clickTracking: { enable: true, enableText: false },
      openTracking: { enable: true },
    },
  };

  if (params.customArgs && Object.keys(params.customArgs).length > 0) {
    msg.customArgs = params.customArgs;
  }

  const [response] = await sgMail.send(msg);
  const messageId = response.headers['x-message-id'] || `sg_${Date.now()}`;

  return {
    sendgridMessageId: messageId,
    status: 'sent',
  };
}

export async function checkSendGridStatus(): Promise<{ ok: boolean; fromEmail: string }> {
  const apiKey = process.env.SENDGRID_API_KEY || '';
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || '';

  if (!apiKey || !fromEmail) return { ok: false, fromEmail };

  try {
    const response = await fetch('https://api.sendgrid.com/v3/user/account', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return { ok: response.ok, fromEmail };
  } catch {
    return { ok: false, fromEmail };
  }
}

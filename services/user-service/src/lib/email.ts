import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const deepLink = `walletos://reset?token=${resetToken}`;
  await resend.emails.send({
    from: 'WalletOS <noreply@resend.dev>',
    to,
    subject: 'Restablece tu contraseña',
    html: buildResetEmailHtml(deepLink),
  });
}

function buildResetEmailHtml(deepLink: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Restablecer contraseña</h2>
      <p>Toca el botón para elegir una contraseña nueva. El enlace caduca en 1 hora.</p>
      <a href="${deepLink}"
         style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px">
        Restablecer contraseña
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px">
        Si no solicitaste este cambio, ignora este correo.
      </p>
    </div>`;
}

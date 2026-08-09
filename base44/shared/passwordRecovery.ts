// Helpers compartilhados para recuperação de senha por email.
// Usados por portalAuth e mechanicAuth (e qualquer outro backend que precise).

export function generateTempPassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export async function sendRecoveryEmail(base44, email, name, tempPassword, systemName) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const subjectLine = `Recuperação de Senha - ${systemName}`;
  const subject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subjectLine)))}?=`;
  const bodyText = `Olá, ${name}!\n\nRecebemos uma solicitação de recuperação de senha para sua conta no ${systemName}.\n\nSua nova senha temporária é: ${tempPassword}\n\nUse-a para acessar o sistema. Recomendamos que você altere a senha após o login.\n\nSe você não solicitou esta recuperação, ignore este email.\n\nAtenciosamente,\n${systemName} - SoftPremier`;
  const message = [
    `To: ${email}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    bodyText
  ].join('\r\n');
  const encoded = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Falha ao enviar email de recuperação: ' + errText);
  }
}
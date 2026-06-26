import { prisma } from '../lib/prisma';
import { sendPush } from '../lib/apns';

type SendInput = {
  type: string;
  title: string;
  body: string;
};

export async function sendNotification(userId: string, input: SendInput): Promise<void> {
  const tokens = await prisma.deviceToken.findMany({ where: { user_id: userId } });

  let finalStatus: 'sent' | 'failed' = tokens.length === 0 ? 'sent' : 'failed';

  await Promise.all(
    tokens.map(async ({ id, token }) => {
      const result = await sendPush(token, input);

      if (result === 'invalid_token') {
        await prisma.deviceToken.delete({ where: { id } });
        return;
      }

      if (result === 'sent') finalStatus = 'sent';
    }),
  );

  await prisma.notification.create({
    data: {
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body,
      status: finalStatus,
    },
  });
}

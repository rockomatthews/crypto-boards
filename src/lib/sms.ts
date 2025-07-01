import twilio from 'twilio';

interface SMSProvider {
  sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

class TwilioProvider implements SMSProvider {
  private client: twilio.Twilio;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }
    
    this.client = twilio(accountSid, authToken);
  }

  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: to,
      });

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMS error',
      };
    }
  }
}

class TextGridProvider implements SMSProvider {
  private apiKey: string;
  private apiUrl = 'https://api.textgrid.com/v1/sms';

  constructor() {
    const apiKey = process.env.TEXTGRID_API_KEY;
    if (!apiKey) {
      throw new Error('TextGrid API key not configured');
    }
    this.apiKey = apiKey;
  }

  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: to,
          message: message,
          from: process.env.TEXTGRID_PHONE_NUMBER!,
        }),
      });

      if (!response.ok) {
        throw new Error(`TextGrid API error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      console.error('TextGrid SMS error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SMS error',
      };
    }
  }
}

class SMSService {
  private provider: SMSProvider | null = null;

  private getProvider(): SMSProvider {
    if (!this.provider) {
      const smsProvider = process.env.SMS_PROVIDER || 'twilio';
      
      switch (smsProvider.toLowerCase()) {
        case 'textgrid':
          this.provider = new TextGridProvider();
          break;
        case 'twilio':
        default:
          this.provider = new TwilioProvider();
          break;
      }
    }
    return this.provider;
  }

  async sendGameInvitation(
    playerPhone: string, 
    inviterName: string, 
    gameType: string, 
    entryFee: number,
    lobbyId: string
  ): Promise<{ success: boolean; error?: string }> {
    const message = `🎮 ${inviterName} invited you to play ${gameType.toUpperCase()}!\n\n` +
      `💰 Entry Fee: ${entryFee} SOL\n` +
      `🔗 Join: ${process.env.NEXT_PUBLIC_APP_URL}/lobby/${lobbyId}\n\n` +
      `Reply STOP to opt out.`;

    return await this.getProvider().sendSMS(playerPhone, message);
  }

  async sendGameStarting(
    playerPhone: string,
    gameType: string,
    gameId: string
  ): Promise<{ success: boolean; error?: string }> {
    const message = `🚀 Your ${gameType.toUpperCase()} game is starting!\n\n` +
      `🎯 Play now: ${process.env.NEXT_PUBLIC_APP_URL}/${gameType}/${gameId}\n\n` +
      `Good luck! 🍀`;

    return await this.getProvider().sendSMS(playerPhone, message);
  }

  async sendGameCompleted(
    playerPhone: string,
    gameType: string,
    isWinner: boolean,
    winnings?: number
  ): Promise<{ success: boolean; error?: string }> {
    const message = isWinner 
      ? `🎉 Congratulations! You won the ${gameType.toUpperCase()} game!\n\n` +
        `💰 Winnings: ${winnings} SOL\n\n` +
        `🎮 Play again: ${process.env.NEXT_PUBLIC_APP_URL}`
      : `😔 Game over! Better luck next time in ${gameType.toUpperCase()}.\n\n` +
        `🎮 Play again: ${process.env.NEXT_PUBLIC_APP_URL}`;

    return await this.getProvider().sendSMS(playerPhone, message);
  }

  async sendFriendRequest(
    playerPhone: string,
    requesterName: string
  ): Promise<{ success: boolean; error?: string }> {
    const message = `👋 ${requesterName} wants to be your friend on Crypto Boards!\n\n` +
      `🔗 Accept: ${process.env.NEXT_PUBLIC_APP_URL}/profile\n\n` +
      `Reply STOP to opt out.`;

    return await this.getProvider().sendSMS(playerPhone, message);
  }

  async sendCustomMessage(
    playerPhone: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    return await this.getProvider().sendSMS(playerPhone, message);
  }
}

// Lazy-loaded instance
let smsServiceInstance: SMSService | null = null;

export const getSMSService = (): SMSService => {
  if (!smsServiceInstance) {
    smsServiceInstance = new SMSService();
  }
  return smsServiceInstance;
};

export const smsService = getSMSService();
export default smsService; 
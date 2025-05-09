import PusherJs from 'pusher-js';
import type { AuthorizerCallback } from 'pusher-js';

// Pusher constants
const PUSHER_APP_KEY = 'k96fb34aa1623a718b629a5db09591946';
const PUSHER_HOST = 'socket.digitalpanel.id';
const PUSHER_PORT = '80';
const PUSHER_SECURE_PORT = '2087';
const PUSHER_APP_TLS = true;
const PUSHER_APP_CLUSTER = 'mt1';
const ECHO_AUTH_HOST = 'https://api.digitalpanel.id';
const ECHO_AUTH_ENDPOINT = '/api/b/broadcasting/auth';

class WebSocketService {
  private pusher: PusherJs | null = null;
  private reconnectTimer: any = null;
  private notificationHandlers: Map<string, (data: any) => void> = new Map();
  private authToken: string | null = null;

  constructor() {
    // Enable Pusher logging
    PusherJs.logToConsole = true;
  }

  public connect(token: string, userId: string): void {
    if (!token || !userId) {
      console.error('Token or userId missing', { hasToken: !!token, hasUserId: !!userId });
      return;
    }

    try {
      console.log('Initializing WebSocket connection', {
        tokenPrefix: token.substring(0, 10) + '...',
        userId
      });

      // Store token for auth
      this.authToken = token;

      // Close existing connection if any
      this.disconnect();

      // Initialize Pusher
      console.log('Creating new Pusher instance');
      this.pusher = new PusherJs(PUSHER_APP_KEY, {
        wsHost: PUSHER_HOST,
        wsPort: parseInt(PUSHER_PORT),
        wssPort: parseInt(PUSHER_SECURE_PORT),
        forceTLS: PUSHER_APP_TLS,
        cluster: PUSHER_APP_CLUSTER,
        enableStats: false,
        authorizer: (channel: { name: string }) => ({
          authorize: (socketId: string, callback: AuthorizerCallback) => {
            if (!this.authToken) {
              callback(new Error('No auth token available'), { auth: '' });
              return;
            }

            fetch(`${ECHO_AUTH_HOST}${ECHO_AUTH_ENDPOINT}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
                'Origin': 'https://app.digitalpanel.id',
                'x-host-origin': 'https://app.digitalpanel.id'
              },
              body: new URLSearchParams({
                socket_id: socketId,
                channel_name: channel.name
              }).toString()
            })
            .then(response => response.json())
            .then(data => {
              callback(null, data);
            })
            .catch(error => {
              callback(error, { auth: '' });
            });
          }
        })
      });

      // Setup connection state handling
      this.setupConnectionHandlers(userId);

      // Force initial connection
      console.log('Forcing initial connection attempt...');
      this.pusher.connect();

    } catch (error) {
      console.error('Error in WebSocket connection:', error);
      this.scheduleReconnect(token, userId);
    }
  }

  private setupConnectionHandlers(userId: string): void {
    if (!this.pusher) return;

    this.pusher.connection.bind('state_change', (states: any) => {
      const { previous, current } = states;
      console.log('WebSocket connection state changed:', {
        previous,
        current,
        timestamp: new Date().toISOString(),
        socketId: this.pusher?.connection.socket_id
      });

      if (current === 'connected') {
        console.log('Successfully connected to WebSocket');
        this.setupChannels(userId);
      } else if (current === 'disconnected' || current === 'failed') {
        console.error('WebSocket connection lost or failed');
        if (this.authToken) {
          this.scheduleReconnect(this.authToken, userId);
        }
      }
    });

    this.pusher.connection.bind('error', (err: any) => {
      console.error('WebSocket connection error:', {
        error: err,
        code: err.data?.code,
        message: err.data?.message
      });
    });
  }

  private setupChannels(userId: string): void {
    try {
      // Subscribe to setting channel
      const settingChannel = this.pusher?.subscribe('setting');
      this.setupChannelHandlers(settingChannel, 'setting');

      // Subscribe to private channel
      const privateChannelName = `private-App.Models.User.${userId}`;
      const privateChannel = this.pusher?.subscribe(privateChannelName);
      this.setupChannelHandlers(privateChannel, privateChannelName);

      // Setup notification handlers
      this.setupNotificationHandlers(privateChannel);

    } catch (error) {
      console.error('Error setting up channels:', error);
    }
  }

  private setupChannelHandlers(channel: any, channelName: string): void {
    channel?.bind('pusher:subscription_succeeded', () => {
      console.log(`Successfully subscribed to ${channelName} channel`);
    });

    channel?.bind('pusher:subscription_error', (error: any) => {
      console.error(`Error subscribing to ${channelName} channel:`, {
        error,
        socketId: this.pusher?.connection.socket_id
      });
    });
  }

  private setupNotificationHandlers(privateChannel: any): void {
    const notificationEvents = [
      'App\\Events\\UserNotification',
      'App\\Events\\OrderNotification',
      'App\\Events\\DownloadNotification',
      'App\\Events\\PointDownloadNotification',
      'App\\Events\\UserBannedNotification'
    ];

    notificationEvents.forEach(eventName => {
      privateChannel?.bind(eventName, (data: any) => {
        console.log(`Received ${eventName}:`, data);
        const handler = this.notificationHandlers.get(eventName);
        if (handler) {
          handler(data);
        }
      });
    });
  }

  public onNotification(eventName: string, handler: (data: any) => void): void {
    this.notificationHandlers.set(eventName, handler);
  }

  public disconnect(): void {
    if (this.pusher) {
      console.log('Disconnecting WebSocket');
      this.pusher.disconnect();
      this.pusher = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.authToken = null;
  }

  private scheduleReconnect(token: string, userId: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.log('Scheduling WebSocket reconnection in 5 seconds...');
    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      this.connect(token, userId);
    }, 5000);
  }

  public isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }
}

export const webSocketService = new WebSocketService(); 
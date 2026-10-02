import os from 'os';
import QRCode from 'qrcode';

export class NetworkService {
  /**
   * Returns all available local IPv4 addresses (excluding internal loopback)
   */
  public static getLocalIPAddresses(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];

    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (!netInterface) continue;

      for (const info of netInterface) {
        // Only IPv4 and not internal loopback
        if (info.family === 'IPv4' && !info.internal) {
          ips.push(info.address);
        }
      }
    }

    return ips.length > 0 ? ips : ['127.0.0.1'];
  }

  /**
   * Gets primary LAN IP
   */
  public static getPrimaryLocalIP(): string {
    const ips = this.getLocalIPAddresses();
    // Prefer standard private IP ranges 192.168.x.x or 10.x.x.x
    const preferred = ips.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.'));
    return preferred || ips[0] || '127.0.0.1';
  }

  /**
   * Generates QR Code data URL for frontend/waiter tablet quick access
   */
  public static async getNetworkAccessInfo(frontendPort: number = 5173, backendPort: number = 4000) {
    const ip = this.getPrimaryLocalIP();
    const tabletUrl = `http://${ip}:${frontendPort}`;
    const apiUrl = `http://${ip}:${backendPort}/api`;

    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(tabletUrl, {
        width: 250,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (e) {
      console.error('Error generating QR code:', e);
    }

    return {
      localIp: ip,
      allIps: this.getLocalIPAddresses(),
      tabletUrl,
      apiUrl,
      qrCodeDataUrl
    };
  }
}

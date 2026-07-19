import { useEffect } from 'react';

export function useLoginLogger(logAction: (action: string, nodeId: string | null, details?: Record<string, any>) => void) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoginAttempt = sessionStorage.getItem('meo-auth-login-attempt');
      if (isLoginAttempt === 'true') {
        sessionStorage.removeItem('meo-auth-login-attempt');
        
        const logLoginDetails = async () => {
          const isElectron = 'electronAPI' in window || (navigator.userAgent && navigator.userAgent.includes('Electron'));
          
          let ipAddress = 'Unknown';
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
            const ipRes = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
            clearTimeout(timeoutId);
            const ipData = await ipRes.json();
            ipAddress = ipData.ip;
          } catch (e) {
            console.warn('Failed to retrieve IP address:', e);
          }

          if (isElectron) {
            let osUsername = 'Unknown';
            let osPlatform = 'Unknown';
            let osType = 'Unknown';
            let friendlyOS = '';
            
            if ('electronAPI' in window && (window as any).electronAPI.getSystemInfo) {
              try {
                const sysInfo = await (window as any).electronAPI.getSystemInfo();
                osUsername = sysInfo.osUsername;
                osPlatform = sysInfo.osPlatform;
                osType = sysInfo.osType;
                friendlyOS = sysInfo.friendlyOS || '';
              } catch (e) {
                console.error('Failed to fetch Electron system details:', e);
              }
            }

            const operatingSystem = friendlyOS || `${osType} (${osPlatform})`;

            logAction('USER_LOGIN', null, {
              platform: 'Desktop App',
              device: 'Desktop',
              os_username: osUsername,
              operating_system: operatingSystem,
              ip_address: ipAddress
            });
          } else {
            const getBrowserName = () => {
              const ua = navigator.userAgent || '';
              if (ua.includes('Firefox')) return 'Firefox';
              if (ua.includes('SamsungBrowser')) return 'Samsung Browser';
              if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
              if (ua.includes('Trident')) return 'Internet Explorer';
              if (ua.includes('Edge') || ua.includes('Edg')) return 'Microsoft Edge';
              if (ua.includes('Chrome')) return 'Chrome';
              if (ua.includes('Safari')) return 'Safari';
              return 'Unknown Browser';
            };

            const getDevice = () => {
              const ua = navigator.userAgent || '';
              const isMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
              return isMobile ? 'Mobile' : 'Desktop';
            };

            let operatingSystem = 'Unknown OS';
            const ua = navigator.userAgent || '';
            
            // Baseline detection from userAgent
            if (ua.includes('Windows Phone')) {
              operatingSystem = 'Windows Phone';
            } else if (ua.includes('Win')) {
              let winVer = 'Windows';
              if (ua.includes('Windows NT 10.0')) winVer = 'Windows 10/11';
              else if (ua.includes('Windows NT 6.3')) winVer = 'Windows 8.1';
              else if (ua.includes('Windows NT 6.2')) winVer = 'Windows 8';
              else if (ua.includes('Windows NT 6.1')) winVer = 'Windows 7';
              
              const is64 = ua.includes('Win64') || ua.includes('x64') || ua.includes('WOW64');
              operatingSystem = `${winVer}${is64 ? ' 64-bit' : ' 32-bit'}`;
            } else if (ua.includes('Mac')) {
              if (navigator.maxTouchPoints > 1) {
                operatingSystem = 'iOS';
              } else {
                let macVer = 'macOS';
                const match = ua.match(/Mac OS X (\d+[._]\d+[._]\d+|\d+[._]\d+)/);
                if (match) {
                  macVer = `macOS ${match[1].replace(/_/g, '.')}`;
                }
                operatingSystem = macVer;
              }
            } else if (ua.includes('Linux')) {
              if (ua.includes('Android')) {
                let androidVer = 'Android';
                const match = ua.match(/Android (\d+(\.\d+)*)/);
                if (match) {
                  androidVer = `Android ${match[1]}`;
                }
                operatingSystem = androidVer;
              } else {
                operatingSystem = 'Linux';
              }
            } else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
              let iosVer = 'iOS';
              const match = ua.match(/OS (\d+_\d+(_\d+)?)/);
              if (match) {
                iosVer = `iOS ${match[1].replace(/_/g, '.')}`;
              }
              operatingSystem = iosVer;
            }

            // Refine with High Entropy values if userAgentData is available
            if ((navigator as any).userAgentData) {
              try {
                const hints = await (navigator as any).userAgentData.getHighEntropyValues([
                  'platformVersion',
                  'architecture',
                  'bitness',
                  'platform'
                ]);
                const platform = hints.platform || '';
                const bitness = hints.bitness || '';
                const platformVersion = hints.platformVersion || '';
                
                if (platform.toLowerCase().includes('windows')) {
                  const major = parseInt(platformVersion.split('.')[0], 10);
                  const winName = major >= 13 ? 'Windows 11' : 'Windows 10';
                  operatingSystem = `${winName}${bitness ? ` ${bitness}-bit` : ' 64-bit'}`;
                } else if (platform.toLowerCase().includes('macos') || platform.toLowerCase().includes('mac os')) {
                  operatingSystem = `macOS ${platformVersion}${bitness ? ` ${bitness}-bit` : ''}`;
                } else if (platform.toLowerCase().includes('android')) {
                  operatingSystem = `Android ${platformVersion}`;
                } else if (platform) {
                  operatingSystem = `${platform} ${platformVersion}${bitness ? ` ${bitness}-bit` : ''}`;
                }
              } catch (e) {
                console.warn('Failed to retrieve userAgentData hints:', e);
              }
            }

            logAction('USER_LOGIN', null, {
              platform: 'Web Dashboard',
              device: getDevice(),
              operating_system: operatingSystem,
              browser: getBrowserName(),
              ip_address: ipAddress
            });
          }
        };

        logLoginDetails();
      }
    }
  }, [logAction]);
}

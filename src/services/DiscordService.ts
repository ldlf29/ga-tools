export class DiscordService {
    private static readonly DISCORD_TOKEN = process.env.DISCORD_TOKEN;
    private static readonly CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
    private static readonly BASE_URL = 'https://discord.com/api/v10';

    /**
     * Sends a formatted message to Discord notifying about class changes.
     */
    static async notifyClassChanges(changes: { moki_name: string, old_class: string, new_class: string }[]) {
        if (!this.DISCORD_TOKEN || !this.CHANNEL_ID) {
            console.warn('⚠️ Discord credentials missing. Skipping Discord notification.');
            return;
        }

        if (!changes || changes.length === 0) return;

        try {
            // Build simple formatted text for the notification
            const descriptionLines = changes.map(c =>
                `**${c.moki_name}**: ${c.old_class || 'None'} ➡️ **${c.new_class}**`
            );

            const payload = {
                embeds: [{
                    title: '🔄 Moki Class Changes Detected!',
                    description: descriptionLines.join('\n'),
                    color: 0x00FF00, // Green color
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: 'Grand Arena Updates'
                    }
                }]
            };

            const response = await fetch(`${this.BASE_URL}/channels/${this.CHANNEL_ID}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${this.DISCORD_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                const errMsg = `Failed to send Discord notification (${response.status}): ${errorText}`;
                console.error(`❌ ${errMsg}`);
                throw new Error(errMsg);
            } else {
                console.log(`✅ Sent Discord notification for ${changes.length} class changes.`);
            }

        } catch (error) {
            console.error('❌ Error sending Discord notification:', error);
        }
    }
}

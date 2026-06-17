import type { ChannelInfo, ChannelPublisher } from "./types.js";

export class ChannelRegistry {
  private readonly channels = new Map<string, ChannelPublisher>();

  constructor(channels: ChannelPublisher[] = []) {
    for (const channel of channels) {
      this.register(channel);
    }
  }

  register(channel: ChannelPublisher): void {
    this.channels.set(channel.id, channel);
  }

  get(id: string): ChannelPublisher {
    const channel = this.channels.get(id);
    if (!channel) {
      throw new Error(`Unknown channel: ${id}`);
    }
    return channel;
  }

  list(): ChannelInfo[] {
    return [...this.channels.values()].map((c) => ({ id: c.id, label: c.label }));
  }
}

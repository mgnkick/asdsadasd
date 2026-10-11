import { WifiNetwork, WifiBand, ChannelRating } from '../types/wifi';

// Standard 2.4 GHz channels
export const CHANNELS_2_4GHZ = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const NON_OVERLAPPING_2_4GHZ = [1, 6, 11];

// Standard 5 GHz channels
export const CHANNELS_5GHZ = [
  36, 40, 44, 48, // UNII-1 (indoor, clean)
  52, 56, 60, 64, // UNII-2 (DFS)
  100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, // UNII-2e (DFS)
  149, 153, 157, 161, 165 // UNII-3
];

// Standard 6 GHz channels (Wi-Fi 6E / 7 sample representative channels)
export const CHANNELS_6GHZ = [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77, 81, 85, 89, 93];

export function getFrequencyForChannel(channel: number, band: WifiBand): number {
  if (band === '2.4GHz') {
    if (channel === 14) return 2484;
    return 2412 + (channel - 1) * 5;
  }
  if (band === '5GHz') {
    return 5000 + channel * 5;
  }
  // 6GHz
  return 5950 + channel * 5;
}

export function analyzeChannels(networks: WifiNetwork[], band: WifiBand): ChannelRating[] {
  const targetChannels = band === '2.4GHz' 
    ? CHANNELS_2_4GHZ 
    : band === '5GHz' 
      ? CHANNELS_5GHZ 
      : CHANNELS_6GHZ;

  const filteredNets = networks.filter(n => n.band === band);

  const ratings: ChannelRating[] = targetChannels.map(channel => {
    const freq = getFrequencyForChannel(channel, band);
    let coChannelCount = 0;
    let coChannelSignalPenalty = 0;
    let adjacentChannelCount = 0;
    let adjacentSignalPenalty = 0;

    filteredNets.forEach(net => {
      const netChannel = net.channel;
      const netLevel = net.level; // e.g. -50 to -90
      // Signal weight: -30dBm is 100x stronger than -80dBm
      const strengthFactor = Math.pow(10, (netLevel + 100) / 30); // 0.1 to 10 approx

      if (netChannel === channel) {
        coChannelCount++;
        coChannelSignalPenalty += strengthFactor * 10;
      } else if (band === '2.4GHz') {
        const diff = Math.abs(netChannel - channel);
        // In 2.4 GHz, channels overlap if diff < 5 (each 20MHz channel spans +/- 2 channels)
        if (diff < 5) {
          adjacentChannelCount++;
          // Adjacent interference is WORSE than co-channel because CSMA/CA preamble detection fails!
          const overlapWeight = (5 - diff) / 5;
          adjacentSignalPenalty += strengthFactor * overlapWeight * 18;
        }
      } else if (band === '5GHz') {
        // In 5GHz, if a neighbor is using 40/80/160 MHz width it can overlap
        const width = net.channelWidth || 20;
        const diff = Math.abs(netChannel - channel);
        if (width >= 80 && diff <= 12) {
          adjacentChannelCount++;
          adjacentSignalPenalty += strengthFactor * 8;
        }
      }
    });

    // Base score calculation
    let penalty = coChannelSignalPenalty + adjacentSignalPenalty;
    
    // In 2.4GHz, non-standard channels (2, 3, 4, 5, 7, 8, 9, 10, 12, 13) get an intrinsic penalty
    // because they suffer interference from BOTH neighboring non-overlapping blocks
    if (band === '2.4GHz' && !NON_OVERLAPPING_2_4GHZ.includes(channel)) {
      penalty += 25;
    }

    let score = Math.max(10, Math.min(100, Math.round(100 - penalty)));
    
    // Calculate stars (1 - 5)
    let stars = 1;
    if (score >= 90) stars = 5;
    else if (score >= 75) stars = 4;
    else if (score >= 55) stars = 3;
    else if (score >= 35) stars = 2;
    else stars = 1;

    let interferenceLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (coChannelCount + adjacentChannelCount === 0) interferenceLevel = 'none';
    else if (score >= 75) interferenceLevel = 'low';
    else if (score >= 50) interferenceLevel = 'medium';
    else interferenceLevel = 'high';

    // Detailed explanation
    let reason = '';
    if (coChannelCount === 0 && adjacentChannelCount === 0) {
      reason = 'Канал полностью свободен от соседних сетей. Идеально для выбора!';
    } else if (band === '2.4GHz' && !NON_OVERLAPPING_2_4GHZ.includes(channel)) {
      reason = `Нестандартный канал. Перекрывается сразу с каналами ${channel - 2} и ${channel + 2}. Приводит к коллизиям.`;
    } else if (adjacentChannelCount > 0 && coChannelCount > 0) {
      reason = `${coChannelCount} сетей на канале, ${adjacentChannelCount} перекрывающих соседей. Сильные коллизии.`;
    } else if (coChannelCount > 0) {
      reason = `${coChannelCount} сетей работают на этом же канале (CSMA/CA делит эфир).`;
    } else {
      reason = `Перекрывается с ${adjacentChannelCount} соседними сетями.`;
    }

    return {
      channel,
      frequency: freq,
      band,
      score,
      stars,
      interferenceLevel,
      isRecommended: false, // will set below
      networksCount: coChannelCount + adjacentChannelCount,
      coChannelNetworks: coChannelCount,
      adjacentChannelNetworks: adjacentChannelCount,
      reason,
    };
  });

  // Determine recommended channel(s)
  // For 2.4 GHz, recommend the best among 1, 6, 11
  if (band === '2.4GHz') {
    const nonOverlapping = ratings.filter(r => NON_OVERLAPPING_2_4GHZ.includes(r.channel));
    nonOverlapping.sort((a, b) => b.score - a.score);
    if (nonOverlapping.length > 0) {
      const best = nonOverlapping[0];
      const match = ratings.find(r => r.channel === best.channel);
      if (match) match.isRecommended = true;
    }
  } else {
    // For 5GHz / 6GHz, pick highest score
    const sorted = [...ratings].sort((a, b) => b.score - a.score);
    if (sorted.length > 0) {
      const best = sorted[0];
      const match = ratings.find(r => r.channel === best.channel);
      if (match) match.isRecommended = true;
    }
  }

  return ratings;
}

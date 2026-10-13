export const SLOW_3G_NETWORK = Object.freeze({
  offline: false,
  latency: 400,
  downloadThroughput: 50_000,
  uploadThroughput: 50_000,
  connectionType: 'cellular3g',
})

export async function applyMeasurementNetwork(
  session,
  network = SLOW_3G_NETWORK,
) {
  await session.send('Network.emulateNetworkConditions', {
    offline: network.offline,
    latency: network.latency,
    downloadThroughput: network.downloadThroughput,
    uploadThroughput: network.uploadThroughput,
    connectionType: network.connectionType,
  })
}

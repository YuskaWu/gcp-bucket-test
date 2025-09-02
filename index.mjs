import Bucket from './Bucket.mjs'


try {
  // const bucket = new Bucket('key-opencall-dev.json', 'opencall-dev')
  const bucket = new Bucket('key.json', 'yuska-test-bucket')

  // await bucket.showFiles()
  // await bucket.uploadFile()
  // await bucket.showFilePublicUrl()
  await bucket.setFolderPublicWithIAM('public')
} catch (e) {
  console.error('ERROR:', e)
}

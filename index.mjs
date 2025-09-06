import Bucket from './Bucket.mjs'


try {
  const bucket = new Bucket('key-opencall-dev.json', 'opencall-dev-public')
  // const bucket = new Bucket('key-yuska-bucket.json', 'yuska-test-bucket')
  // await bucket.showBucketMetadata()
  // await bucket.showFiles()
  // await bucket.createFolder('public')
  // await bucket.deleteFile('test.txt')
  // await bucket.uploadFile('', 'test.txt')
  // await bucket.downloadFile('test.txt', './test3.txt')
  // await bucket.showFilePublicUrl('test.txt')
} catch (e) {
  console.error('ERROR:', e)
}

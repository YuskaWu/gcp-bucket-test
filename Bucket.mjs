
import { Storage } from '@google-cloud/storage'
import fs from 'fs'

const TEST_FILE = 'test.txt'

export default class BucketTest {
  bucket = null
  bucketName = ''

  constructor(keyFileName, bucketName) {
    if (!keyFileName) {
      throw new Error('keyFileName is required')
    }

    if (!bucketName) {
      throw new Error('bucketName is required')
    }

    // Creates a client
    const storage = new Storage({
      keyFilename: keyFileName
    })

    this.bucket = storage.bucket(bucketName)
    this.bucketName = bucketName
  }


  async showFiles() {
    // Lists files in the bucket
    const [files] = await this.bucket.getFiles()

    console.log('[showFiles] file count:', files.length)
    if (files.length) {
      console.log('[showFiles] ---------------')
    }
    files.forEach(file => {
      console.log('[showFiles] ' + file.name)
    })
  }

  async uploadFile() {
    const newLineStr = new Date().getTime() + ''
    fs.appendFileSync(TEST_FILE, '\r\n')
    fs.appendFileSync(TEST_FILE, newLineStr)

    console.log(`[uploadFile] append ${newLineStr}" to ${TEST_FILE}`)

    await this.bucket.upload(TEST_FILE, {
      destination: TEST_FILE,
      preconditionOpts: { ifGenerationMatch: 0 }
    })
    console.log(`[uploadFile] ${TEST_FILE} uploaded to ${this.bucketName}`)
  }

  async showFilePublicUrl() {
    const file = await this.bucket.file('test.txt')
    console.log('[showFilePublicUrl] file public url:', file.publicUrl())
  }

  async setFolderPublicWithIAM(folderName) {
    // 1. 取得儲存桶目前的 IAM 政策
    const [policy] = await this.bucket.iam.getPolicy({ requestedPolicyVersion: 3 })

    // 重要：IAM 政策版本必須是 3 或以上才支援 Conditions
    if (policy.version < 3) {
      policy.version = 3
    }

    // 2. 定義要新增的 IAM 綁定 (binding)
    // - role: 'roles/storage.objectViewer' 讓使用者可以讀取物件
    // - members: ['allUsers'] 代表網際網路上的任何人
    const newBinding = {
      role: 'roles/storage.objectViewer',
      members: ['allUsers'],
      // 關鍵的條件設定
      condition: {
        title: `Allow public access to folder ${folderName}`,
        description: `Grants read access to all objects in the '${folderName}' directory.`,
        // Common Expression Language (CEL) 表示式
        // 只有當物件名稱以此前綴開頭時，此規則才生效
        expression: `resource.name.startsWith('projects/_/buckets/${this.bucketName}/objects/${folderName}/')`,
      },
    }

    // 3. 檢查是否已存在完全相同的綁定，避免重複新增
    const bindingExists = policy.bindings.some(
      (b) =>
        b.role === newBinding.role &&
        JSON.stringify(b.members) === JSON.stringify(newBinding.members) &&
        JSON.stringify(b.condition) === JSON.stringify(newBinding.condition)
    )

    if (bindingExists) {
      console.log(`IAM policy for folder "${folderName}" already exists. No changes made.`)
      return
    }

    // 將新的綁定加入政策中
    policy.bindings.push(newBinding)

    // 4. 設定更新後的 IAM 政策
    await this.bucket.iam.setPolicy(policy)

    console.log(
      `[setFolderPublicWithIAM] Successfully set folder "${folderName}" in bucket "${this.bucketName}" to be publicly accessible.`
    )
    console.log(`[setFolderPublicWithIAM] Public URL will be: https://storage.googleapis.com/${this.bucketName}/${folderName}/<your-file-name>`)
  }
}
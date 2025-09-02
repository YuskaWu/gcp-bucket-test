// Imports the Google Cloud client library
import { Storage } from '@google-cloud/storage'
import fs from 'fs'

// Creates a client
const storage = new Storage({
  keyFilename: 'key.json'
})

// The ID of your GCS bucket
const BUCKET_NAME = 'yuska-test-bucket'
const TEST_FILE = 'test.txt'

const bucket = storage.bucket(BUCKET_NAME)

async function showFiles() {
  // Lists files in the bucket
  const [files] = await bucket.getFiles()

  console.log('[showFiles] file count:', files.length)
  if (files.length) {
    console.log('[showFiles] ---------------')
  }
  files.forEach(file => {
    console.log('[showFiles] ' + file.name)
  })
}

async function uploadFile() {
  const newLineStr = new Date().getTime() + ''
  fs.appendFileSync(TEST_FILE, '\r\n')
  fs.appendFileSync(TEST_FILE, newLineStr)

  console.log(`[uploadFile] append ${newLineStr}" to ${TEST_FILE}`)

  const response = await bucket.upload(TEST_FILE, {
    destination: TEST_FILE,
    preconditionOpts: { ifGenerationMatch: 0 }
  })
  console.log(`[uploadFile] ${TEST_FILE} uploaded to ${BUCKET_NAME}`)
  // console.log('[uploadFile] upload resposne:', response)
}

async function showFilePublicUrl() {
  const file = await bucket.file('test.txt')
  console.log('[showFilePublicUrl] file public url:', file.publicUrl())
}

async function setFolderPublicWithIAM(folderName) {
  // 1. 取得儲存桶目前的 IAM 政策
  const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 })

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
      expression: `resource.name.startsWith('projects/_/buckets/${BUCKET_NAME}/objects/${folderName}/')`,
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
  await bucket.iam.setPolicy(policy)

  console.log(
    `[setFolderPublicWithIAM] Successfully set folder "${folderName}" in bucket "${BUCKET_NAME}" to be publicly accessible.`
  )
  console.log(`[setFolderPublicWithIAM] Public URL will be: https://storage.googleapis.com/${BUCKET_NAME}/${folderName}/<your-file-name>`)
}

try {
  await showFiles()
  // await uploadFile()
  // await showFilePublicUrl()
} catch (e) {
  console.error('ERROR:', e)
}

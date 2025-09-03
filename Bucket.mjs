
import { Storage } from '@google-cloud/storage'
import fs from 'fs'


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


  static async createPublicUniformBucket(keyFileName, bucketName) {
    console.log(`[createPublicUniformBucket] 準備建立儲存桶：${bucketName}`)

    try {
      // --- 步驟 1: 建立儲存桶並啟用 Uniform Bucket-Level Access ---
      const storage = new Storage({ keyFilename: keyFileName })
      // 執行建立儲存桶的操作
      const [bucket] = await storage.createBucket(bucketName, {
        location: 'asia-east1',
        storageClass: 'STANDARD',
        // 關鍵設定：IAM 組態
        iamConfiguration: {
          uniformBucketLevelAccess: {
            enabled: true, // 啟用 Uniform Bucket-Level Access
          },
        },
      })
      console.log(`[createPublicUniformBucket] ✅ 儲存桶 "${bucket.name}" 建立成功，並已啟用 Uniform Bucket-Level Access。`)

      // --- 步驟 2: 設定 IAM 政策，將儲存桶設為公開 ---

      console.log(`[createPublicUniformBucket] 準備將儲存桶 "${bucket.name}" 設為公開...`)

      // 定義要授予的 IAM 角色和成員
      const publicRole = 'roles/storage.objectViewer' // 允許查看(下載)物件的角色
      const publicMember = 'allUsers'                 // 代表網際網路上的任何人

      // 取得儲存桶目前的 IAM 政策
      const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 })

      // 新增一個綁定 (binding)，將角色授予成員
      policy.bindings.push({
        role: publicRole,
        members: [publicMember],
      })

      // 將更新後的政策設定回儲存桶
      await bucket.iam.setPolicy(policy)

      console.log(
        `[createPublicUniformBucket] ✅ 儲存桶 "${bucket.name}" 已成功設為公開。任何人都可以讀取其中的物件。`
      )

      return bucket

    } catch (error) {
      if (error.code === 409) {
        console.error(`[createPublicUniformBucket] ❌ 錯誤：儲存桶名稱 "${bucketName}" 已被佔用，請換一個名稱。`)
      } else {
        console.error(`[createPublicUniformBucket] ❌ 建立或設定儲存桶時發生錯誤:`, error)
      }
    }
  }

  async showBucketAccessControlType() {
    const [metadata] = await this.bucket.getMetadata()
    console.log('[showBucketAccessControlType] metadata:', metadata)
    // const uniformBucketLevelAccess = metadata.uniformBucketLevelAccess.enabled
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

  async createFolder(folderName) {
    const file = this.bucket.file(`${folderName}/`) // Note the trailing slash
    await file.save('') // Save an empty string to create the placeholder
    console.log(`[createFolder] Folder '${folderName}' created in bucket '${this.bucketName}'.`)
  }


  async uploadFile(prefixPath = '', file = 'test.txt') {
    const newLineStr = new Date().getTime() + ''
    fs.appendFileSync(file, '\r\n')
    fs.appendFileSync(file, newLineStr)

    console.log(`[uploadFile] append ${newLineStr}" to ${file}`)

    const path = prefixPath + file

    await this.bucket.upload(file, {
      destination: path,
      preconditionOpts: { ifGenerationMatch: 0 }
    })
    console.log(`[uploadFile] ${file} uploaded to ${this.bucketName}/${path}`)
  }

  async showFilePublicUrl() {
    const file = await this.bucket.file('test.txt')
    console.log('[showFilePublicUrl] file public url:', file.publicUrl())
  }

  async setFolderPublicWithIAM(folderName) {
    console.log('Fetching current IAM policy...')
    // 1. 取得儲存桶目前的 IAM 政策
    const [policy] = await this.bucket.iam.getPolicy({ requestedPolicyVersion: 3 })

    // IAM 政策版本必須是 3 或以上才支援 Conditions
    if (policy.version < 3) {
      policy.version = 3
    }

    const roleToModify = 'roles/storage.objectViewer'
    const memberToModify = 'allUsers'

    // 2.【關鍵步驟】過濾掉所有舊的、無條件的公開規則
    // 我們只保留那些不是授予 allUsers 的規則，或者是有條件的規則
    const originalBindingsCount = policy.bindings.length
    policy.bindings = policy.bindings.filter(binding => {
      const isPublicViewerRole =
        binding.role === roleToModify && binding.members.includes(memberToModify)

      // 如果是授予 allUsers 的 viewer 角色，只有在它"已經有"條件時才保留，否則就過濾掉
      if (isPublicViewerRole) {
        return binding.condition != null
      }
      // 其他所有規則都保留
      return true
    })

    if (policy.bindings.length < originalBindingsCount) {
      console.log('Found and removed one or more unconditional public access rules.')
    } else {
      console.log('No unconditional public access rules found to remove.')
    }


    // 3. 定義並新增我們想要的、帶有條件的新規則
    const newBinding = {
      role: roleToModify,
      members: [memberToModify],
      condition: {
        title: `Allow public access to folder ${folderName}`,
        description: `Grants read access to all objects in the '${folderName}' directory.`,
        expression: `resource.name.startsWith('projects/_/buckets/${this.bucketName}/objects/${folderName}/')`,
      },
    }

    // 檢查是否已存在完全相同的綁定，避免重複新增
    const bindingExists = policy.bindings.some(b => JSON.stringify(b) === JSON.stringify(newBinding))

    if (!bindingExists) {
      policy.bindings.push(newBinding)
      console.log(`[setFolderPublicWithIAM] Adding new conditional rule for folder "${folderName}"...`)
    } else {
      console.log(`[setFolderPublicWithIAM] The exact conditional rule for folder "${folderName}" already exists. No changes made.`)
    }

    // 4. 設定更新後的 IAM 政策
    console.log('[setFolderPublicWithIAM] Setting updated IAM policy...')
    await this.bucket.iam.setPolicy(policy)

    console.log(
      `[setFolderPublicWithIAM] Successfully configured public access for folder "${folderName}" in bucket "${this.bucketName}".`
    )
  }
}
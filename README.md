1. Ｃreate service account, grant following roles to it:
   - **Storage Object Viewer**: Grants read and list permissions on objects within the bucket. 
   - **Storage Object Creator**: Grants permissions to create objects within the bucket.
   - **Storage Admin**: Grants full control over the bucket and its objects (use with caution, as this provides broad access).
2. Generate a key(json format) using the service account created in the first step, then copy it to this directory and rename it to `key.json`.
3. Inside `index.mjs`, modify the value of `BUCKET_NAME` variable to the bucket you want to try, and also modify function call at the end of index.mjs
4. run `docker compose up` to invoke index.mjs
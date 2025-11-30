# Firebase Storage Setup Guide

Bu proje artık dosya yüklemeleri için Firebase Storage kullanmaktadır. Railway sunucusu restart olduğunda dosyalar kaybolmayacak.

## Gereksinimler

1. Firebase projesi oluşturun: https://console.firebase.google.com/
2. Firebase Storage'ı etkinleştirin
3. Service Account anahtarı oluşturun

## Kurulum Adımları

### 1. Firebase Console'da Storage'ı Etkinleştirin

1. Firebase Console > Storage > Get Started
2. Production mode seçin
3. Storage bucket'ınızın adını not edin (örn: `your-project.appspot.com`)

### 2. Service Account Anahtarı Oluşturun

1. Firebase Console > Project Settings > Service Accounts
2. "Generate New Private Key" butonuna tıklayın
3. JSON dosyası indirilecek

### 3. Railway Environment Variables Ekleyin

Railway dashboard'da aşağıdaki environment variable'ları ekleyin:

#### FIREBASE_SERVICE_ACCOUNT
Service Account JSON dosyasının içeriğini **string olarak** ekleyin:

```json
{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

**Önemli:** JSON'u tek satır haline getirin ve tırnak işaretlerini escape edin. Railway'de environment variable olarak eklerken JSON'u string olarak ekleyin.

#### FIREBASE_STORAGE_BUCKET
Storage bucket adınızı ekleyin:

```
your-project.appspot.com
```

### 4. Firebase Storage Kurallarını Ayarlayın

Firebase Console > Storage > Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Public read access for all files
    match /{allPaths=**} {
      allow read: if true;
      allow write: if false; // Only backend can write via Admin SDK
    }
  }
}
```

## Klasör Yapısı

Firebase Storage'da dosyalar şu klasörlerde saklanır:

- `profile/` - Kullanıcı profil fotoğrafları
- `forum/` - Forum post görselleri
- `events/` - Etkinlik görselleri
- `teams/` - Takım görselleri
- `businesses/` - İşletme belgeleri

## Test Etme

1. Backend'i deploy edin
2. Bir profil fotoğrafı yükleyin
3. Firebase Console > Storage'da `profile/` klasöründe dosyanın göründüğünü kontrol edin
4. Veritabanında `profileImage` alanının Firebase URL'i olduğunu kontrol edin

## Sorun Giderme

### "Firebase is not initialized" hatası
- `FIREBASE_SERVICE_ACCOUNT` ve `FIREBASE_STORAGE_BUCKET` environment variable'larının doğru ayarlandığından emin olun
- Service Account JSON'unun geçerli olduğunu kontrol edin

### "Permission denied" hatası
- Firebase Storage Rules'ın doğru ayarlandığından emin olun
- Service Account'un Storage'a yazma izni olduğundan emin olun

### Dosyalar görünmüyor
- Firebase Console > Storage'da dosyaların yüklendiğini kontrol edin
- Veritabanında URL'lerin Firebase URL formatında olduğunu kontrol edin

## Notlar

- Artık `uploads/` klasörü kullanılmıyor
- Tüm dosyalar Firebase Storage'da saklanıyor
- Dosya URL'leri doğrudan Firebase public URL formatında (örn: `https://storage.googleapis.com/bucket-name/folder/filename`)
- Frontend'de değişiklik yapılmasına gerek yok, FormData ile upload edilen dosyalar çalışmaya devam ediyor




# Dokuma — tekstil fabrikası yerleşkesi

240 × 180 metre ölçüsünde, altı binadan oluşan Three.js fabrika simülasyonu. Boyahane, apre ve final kalite tek 147 × 50 metre üretim binasında bulunur. Mal kabul, ham depo, konfeksiyon, mamul depo ve enerji merkezi ayrı binalardır; servis yolları ve yükleme avluları ile bağlanır.

Konfeksiyon referans düzeni: kumaş serim → kesim → üç paralel dikim bandı → askı taşıma → son kalite kontrol → ütü → form finisher → rulo konveyör → koli paketleme → mamul depoda paletleme ve sevkiyat. Verilen 11 konfeksiyon GLB modeli kullanılır; askı rafları çalışma alanına eklenir. Her dikim bandında 24 operatör vardır. Operatör elleri/iğneler, kesim kafası, raylara asılı giysiler, son işlem buharı ve konveyör kolileri istasyonun simülasyon durumuna göre hareket eder. Dikim çıkışı henüz kolilenmemiş giysi demetidir; koli paketleme sonunda oluşur. Eski kayıt bir kez yedeklenerek yeni aşamalara geçirilir; makine parametreleri korunur.

## Çalıştırma

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Terminalde belirtilen yerel adresi açın. `npm run build` üretim çıktısını `dist` klasörüne yazar.

## Kullanım

- Bir binaya tıklayın veya **Bina seç** listesini kullanın. Çatı ve kameraya bakan duvarlar açılır; diğer binalar kapalı kalır.
- **Yerleşke** genel görünüme döner ve bütün çatıları kapatır. Sol listeden makine seçmek ilgili binayı açar ve makineye odaklanır.
- Fare ile döndürün/yakınlaşın; WASD ile kamerayı kaydırın. Bu sürüm bina incelemeli yönetim görünümü kullanır.
- Otomatik ışık simülasyon saatini izler. **Gündüz / Gece** seçenekleri sadece görüntüyü değiştirir, üretim saatini değiştirmez.
- Akış ve boru akışı isteğe bağlı teknik katmanlardır. Gerçek boru tesisatı sürekli görünür.
- Üstteki panel düğmeleri bölüm listesini, inceleme panelini ve olay günlüğünü daraltır.
- **Düzenle** simülasyonu duraklatır. Makine taşıma/döndürme sonunda yeni çakışmalar reddedilir. Düzenlemeyi bitirirken tüm yerleşim ve bağlantılar kontrol edilir; önceki duraklatma tercihi geri yüklenir.
- **Görsel ↓** güncel sahneden başlıklı bir PNG hazırlar. PNG bağlantısıyla kaydedilebilir; geliştirme sunucusunda ayrıca `.artifacts` klasörüne yazılır.
- Düzenle araçları JSON aktarımını, varsayılana dönmeyi ve yeni makine eklemeyi içerir. Eklemek için önce bir bina açın.

## Veri ve uyumluluk

`Layout.version = 2` bina kabuklarını/kapıları, bölüm–bina eşleşmelerini, yolları, dış sahaları ve yardımcı tesis güzergâhlarını içerir. Makine pozisyonları dünya koordinatıdır; bir birim bir metredir. Kimlikler, parametreler ve `next` üretim bağlantıları korunur.

Eski `factory-layout-v1` kaydı değiştirilmez; ayrıca `factory-layout-v1-backup` yedeği tutulur. Dönüştürülen veri `factory-layout-v2` anahtarına yazılır. Bilinen makineler yeni varsayılan konumlarına taşınır, kullanıcı konum farkları korunur; özel makineler bölüm merkezlerine göre aktarılır. Sığmayan yerleşimler olay günlüğünde işaretlenir ve simülasyon durur. İçe aktarma ve sıfırlama öncesinde mevcut v2 kaydı da yedeklenir.

Ayrı apre binası içeren v2 kayıtları da açılışta yedeklenir: iki bina tek kabukta birleştirilir, makine konumları/parametreleri/bağlantıları korunur. Eski ara yolun bina içinden geçen bölümü kaldırılır. Bölüm listesinden boyahane, apre veya final kalite seçimi aynı çatıyı açar.

Varsayılan JSON, `npm run layout` ile yeniden üretilir. Üretici, eski makine kimliklerini/parametrelerini ve ortak kampüs kurucusunu kullanır; bina koordinatları için ikinci bir kaynak tutulmaz.

Bir metrelik ortak navigasyon rasteri; bina/oda duvarlarını, yük kapılarını, yolları, avluları ve şişirilmiş makine ayak izlerini kullanır. Kapalı güzergâhta ürün gönderilmez, bir uyarı üretilir. Her transferin yolu `LotSnap.route` içinde taşınır; süresi 6 saniye yükleme + araç hızına göre yol süresi + 6 saniye indirmedir. Forklift 2,2 m/sn, personelin ittiği araba 1,2 m/sn kullanır. Başlamış transferlerin yolu ve araç türü düzenleme sırasında sabit kalır.

Yük araçtaki fiziksel `loadSocket` grubunun çocuğudur: araç dönerken ve hareket ederken onunla birlikte hareket eder. Forkliftler paletleri düşük çatal yüksekliğinde taşır; kumaşlar beşik/palet veya ıslak kumaş haznesindedir. İç kumaş taşıması kumaş arabası, demet/koli taşıması personelli platform arabası kullanır. Araç zemine indirdikten sonra güzergâhı boş döner ve aynı çıkış noktasından gelen yeni işler için tekrar kullanılır. Teslimat kuyruğunda ayrı park yeri rezerve edilir; sıradaki başka bir ürün işlendiğinde bekleyen ürün kendiliğinden kaymaz. Filo kapasitesi ve trafik beklemeleri üretime ek kısıt getirmez.

Kamyon hareketleri sekiz kumaş girişine ve altı palet sevkiyatına bağlıdır; lojistik olayların görsel temsilidir. Üretim ve kazan arızası/boya stoğu davranışları mevcut simülasyon motorunu kullanır.

Malzemeler/dokular yerelde prosedürel üretilir; ücretli model paketi veya çevrimiçi doku servisi gerekmez. `public/assets/manifest.json` mevcut Türkçe adlandırılmış GLB dosyalarını makinelere ve hareketli araçlara bağlar. Eksik modeller prosedürel karşılıklarıyla çalışır. Model ekleme, yön ve yük soketi ayarları için [asset yönergesi](../public/assets/README.md). Yerel GLB desteği ve makine tipine dosya sürükleyip bırakma korunur. Tek makinenin JSON `asset` alanı da kullanılır.

## Doğrulama

```sh
npm run typecheck
npm test
npm run simtest
npm run build
```

`npm test`: varsayılan makine/kuyruk sınırları ve çakışmaları, 72 üretim güzergâhı, duvar engeli ve kapı geçişi, JSON aktarımı, eski/özel makine dönüşümü, iki üretim binasının kayıt kaybetmeden birleştirilmesi, transfer süresi/yol eşleşmesi ve sabit rastgelelik ile 6,5 saatlik üretim/kazan arızası/onarım kontrolü. Birleşik bina ve yeni taşıma süreleriyle standart senaryoda 450 civarında palet sevk edilir. Ek lojistik testi fiziksel yük bağlantısını, çatal/platform yüksekliğini, zemine indirmeyi, boş dönüşü, duraklatmayı, asset ölçü normalizasyonunu ve verilen forklift GLB'sinin hareketli çatallarını kontrol eder.

7 Ekim 2026 tarihindeki masaüstü tarayıcı kontrolünde 1920 × 1080 sayfa, 1705 × 978 sahne tamponu kullanıldı. Gündüz genel görünümünde 35–37 FPS, gece depo incelemesinde yaklaşık 32 FPS gözlendi; sonraki arka plan örnekleri 16–18 FPS'e indi. Bunlar bu oturumun örnekleridir, sabit donanım garantisi değildir. Anlık FPS, çizim sayısı ve tampon ölçüsü sahnenin sağ alt köşesinde görünür.

Tekrarlı çevre ve makine parçaları `InstancedMesh` ile çizilir; kapalı binaların makine modelleri çizimden çıkarılır. Yeni türüne geçen veya biten lotların GPU kaynakları serbest bırakılır. Taşıma geliştirmesinin önceki üretim derlemesi başarılıdır; Three.js içeren ana paket için Vite'ın 500 kB paket boyutu uyarısı vardır. Son bina birleştirmesi ve model eklemeleri TypeScript ve testlerle doğrulandı; son üretim derlemesi izin reddedildiği için yeniden çalıştırılmadı.


## Mal kabul referansı

Mal kabul, verilen görsel ve `mal-kabul-yerlesim.js` koordinatlarına göre 40 × 28 m, 6 m yüksekliğinde kurulmuştur. Kabul masası ve pano sol duvarda; 18 × 5,5 m sundurma aynı duvara bağlıdır. Giriş konveyörü önden arkaya çalışır, tartı sağında, bekleme kafesi sağ arka taraftadır. Ön sağdaki üç palet alanı, sarı forklift koridoru ve yaya geçişi görsele göre yerleştirilmiştir.

Görseldeki uzun giriş hattını karşılamak için konveyör 14 m, portal konveyörün arka ucundadır; navigasyon ve ürün hareketi aynı ölçüyü kullanır. Paletlerin rulo uçları inceleme kamerasına bakar. Ortada boş bir yedek forklift park eder; çalışan transferlerin araçları gerçek stokları taşır. `http://127.0.0.1:5174/?inspect=receiving` mal kabulü gündüz, çatı açık ve duraklatılmış olarak açar.

8 Ekim 2026 kontrolünde 1920 × 1080 sayfa ve 1920 × 978 sahnede duraklatılmış mal kabul 33–39 FPS ve yaklaşık 1052 çizim çağrısı gösterdi. 20x üretim ve birden fazla aktif forkliftle 31–34 FPS, 1076–1134 çizim çağrısı görüldü. Bunlar bu bilgisayardaki kısa örneklerdir.

Kaynak dosyaların değişmeden korunan kopyaları `public/assets/mal-kabul/source` içindedir. `node scripts/importReceivingAssets.mjs` ile modül yeniden üretilir. Uyarlama, demo kodunu modül dışında çalıştırmaz; Three.js `position` alanının atanması yerine `position.set` kullanır. Üretim kodu `src/receivingView.ts`, yerleşim geçişi `src/receivingLayout.ts` içindedir.

Başlangıçtaki sekiz kumaş partisi gerçek simülasyon stokudur: kafes ve ön palet alanlarında beş, giriş konveyöründe iki, tartıda bir parti vardır. Bu paletler WIP'e dahildir ve forkliftler onları gerçek park yerlerinden alarak kafes kapısından geçirir. Ekranlarda gerçek parti kimlikleri ve tartım ağırlığı gösterilir. Kayıt, tarama, tartım ve depo onayı birbirine bağlı çalışan istasyonlardır. Açılış hızı 1x'tir; hız düğmeleriyle artırılabilir.

`receivingRevision = 3` geçişi önceki kaydı yedekler, standart mal kabul istasyonlarını referans konumlarına taşır, parametreleri ve özel çıkış bağlantılarını korur. Yerleşim JSON'u sundurma kolonları ve güvenlik korkuluğu için navigasyon engellerini de taşır. Kapalı binaların içindeki araçlar ve stoklar çizimden çıkarılır.

Boyahane/apre/kalite tek binada 12 HT, üç halat açma ve üç sıkma–kurutma–ramöz–kompaktör hattı kullanır. Sağlanan GLB'ler yedekli su arıtma, kompresör, tanklar ve iki boya hazırlama istasyonunu da içerir. Yeni kopyalanan assetler geliştirme sunucusunda yeniden başlatma gerektirmeden sunulur.

## Ham kumaş deposu referansı

`public/assets/ham-kumas-depo` içindeki 10 GLB kullanılır. 32 × 24 m depoda sol duvar boyunca üç dolu raf modülü, ön solda stok kontrol masası, ortada forklift koridoru ve sağda altı parti alanı vardır. Raflar 5,42 m yüksekliğe ölçeklenir; kabuk 7,5 m binaya uyarlanır. Verilen kabuğun duvar yönü ve kapı modeli, referanstaki sol/arka duvar ve açık yük geçişine uyarlanır. Dosyaların asılları değiştirilmez.

Altı parti alanında 12 gerçek başlangıç paleti vardır; WIP'e dahil edilirler ve boyahaneye bulundukları hücreden forkliftle alınırlar. Gelen paletler boş hücrelere ayrılır. Raf GLB'sindeki kumaş ve kutular sabit model dekorudur; bunlar ek simülasyon partileri gibi sayılmaz. RAWSTORE-01 kimliği, parametreleri ve üretim bağlantıları korunur; `rawRevision=1` kayıt geçişi ve JSON aktarımı desteklenir. `src/rawLayout.ts` hücre ve raf engellerini, `src/rawView.ts` model yerleşimini tanımlar. Aynı hücreler arası yollar tekrar kullanılmak üzere önbelleğe alınır.

`http://127.0.0.1:5174/?inspect=raw` ham depoyu gündüz ve duraklatılmış olarak açar. 1x düğmesi üretimi başlatır. Mevcut modeller bu yerleşimi kurmaya yeterlidir; ek model paketi gerekmez.

## Mamul ve sevkiyat referansı

Depoda üç uzun paralel sıra halinde dokuz büyük raf modülü, sağ duvarda dört küçük raf, sağda paketleme konveyörü–etiketleme–paletleme hattı bulunur. Ön solda dört hazırlık paleti, ön sağda sekiz sevke hazır palet vardır. Sol duvarda iki yük kapısı, rampalar, sarı güvenlik çizgileri ve forklift koridorları referansa göre yerleştirilmiştir. Sağlanan `ham-kumas-depo/raf.glb`, stok kontrol masası, küçük ekipmanlar, bariyerler, bitkiler; `konfeksiyon` paketleme masası, konveyörü ve koli paleti; mevcut forklift ve kamyon modelleri kullanılır. Rafların tekrar eden geometri ve malzemeleri ortak çizim gruplarında paylaşılır.

On iki başlangıç paleti gerçek simülasyon stokudur. Gelen paletler boş hücrelere ayrılır; forkliftler paletleri bu hücrelerden alır ve batı yük kapısından sevkiyata taşır. Raf modelinin içindeki kumaş ve kutular sabit dekor olup ek stok sayılmaz. Paketleme, barkod ve paletleme istasyonları üretim akışına bağlıdır; çalışan operatörler istasyonun durumuna göre hareket eder. Altı sevk paleti kamyonun lojistik hareketini tetikler. `shippingRevision=2` geçişi mevcut kayıt ve parametreleri korur; dışa aktarılan JSON yeni istasyonları, kapıları, avluları ve raf engellerini içerir. Varsayılan yerleşimde 76 makine ve 74 üretim bağlantısı vardır.

`http://127.0.0.1:5174/?inspect=warehouse` depoyu çatı açık, gündüz ve duraklatılmış açar. 1x üretimi başlatır. Özel palet streçleme makinesi ve hidrolik yükleme köprüsü GLB'leri mevcut assetlerde bulunamadı. Şimdilik paletleme masası ve sabit rampa kullanılır; bu iki model verildiğinde değiştirilebilir.

8 Ekim 2026 mamul/sevkiyat kontrolünde 1920 × 1080 sayfa ve 1920 × 978 sahnede aktif üretim örneği 15 FPS / 1543 çizim çağrısı gösterdi. Arka plandaki duraklatılmış/gece örnekleri 2 FPS'e indi; bu oturumdaki örnekler sabit performans garantisi değildir. Raf gruplaması sonrasında duraklatılmış çizim sayısı 1472'den 1167'ye düştü. TypeScript, 74 güzergâh, kayıt geçişi, 6,5 saat üretim ve fiziksel taşıma testleri geçti; üretim derlemesi yeniden çalıştırılmadı.

## Enerji merkezi referansı

`public/assets/enerji-odasi` içindeki 10 GLB'nin tamamı kullanılır. 22 × 16 m, 6,5 m yüksekliğindeki binada kazan ortada; su yumuşatma, besleme tankı ve kimyasal dozaj solda; yakıt skidi ön solda ve kompresör ön sağdadır. Buhar manifoldu arka sağ duvarda 3,6 m kotunda, kondens dönüşü onun önündedir. Baca, duvar boruları, servis panoları, güvenlik çizgileri, drenaj ve destekli borular referans yerleşimini tamamlar. Kazan için mevcut `buhar-kazani.glb` korunur. Kaynak GLB dosyaları değiştirilmez; modele göre metre ölçüsünde yerleşim kullanılır.

Yedi yeni ekipman seçilebilir, gerçek simülasyon durumu ve arıza/onarım göstergelerine sahiptir. Yakıt, besleme tankı veya su yumuşatma arızası kazanı yardımcı tesis beklemesine geçirir ve basıncı düşürür; onarım basıncı yeniden yükseltir. Manifold ve kondens hattı, kazan basıncını ve üretimin buhar yükünü gösterir. Boyahanedeki mevcut yedekli kompresör/arıtma mantığı korunur. Bu bir ayrıntılı termodinamik model değildir; mevcut üretim simülasyonunun yardımcı tesis davranışını kullanır.

`energyRevision=3` kayıt geçişi standart enerji binasını günceller; kazan kapasitesi, arıza parametreleri ve özel assetleri korunur. Yerleşim üreticisi ve JSON günceldir: 83 makine, 74 üretim bağlantısı. TypeScript ve testler yerleşim sınırlarını, kayıt geçişini, yakıt arızasını, manifold basıncını, onarım sonrası toparlanmayı ve 6,5 saatlik üretimi doğrular. `http://127.0.0.1:5174/?inspect=utility` gündüz, çatı açık ve duraklatılmış enerji merkezi görünümünü açar.

Enerji odasının metal yüzeyleri için yerelde üretilen ortak küp yansıma dokusu kullanılır; yeni bir dosya indirilmez ve diğer binaların malzemeleri değiştirilmez. Bu kontrolün 1239 × 1409 sahnesinde kısa gündüz örneği 31 FPS / 931 çizim, aktif üretim örneği 27 FPS / 931 çizim gösterdi; arka plan örnekleri daha düşüktür. Üretim derlemesi yeniden çalıştırılmadı.


## Güneş, batarya ve şebeke senaryosu

Tüm bina çatılarında 550 W'lık panel hücreleri yerleştirilir. Ortak yerleşim fonksiyonu hem görsel panel sayısını hem kurulu DC gücü hesaplar. Kenar boşlukları, mahya servis koridoru, ışıklıklar ve enerji bacası çevresi açık bırakılır. Panel yüzeyleri yerelde üretilen hücre dokusunu ve ortak geometriyi kullanır; bina incelemesinde paneller çatıyla birlikte gizlenir.

07 · GÜNEŞ / BATARYA MERKEZİ, kuzeyde 18 × 14 m ayrı elektrik odasıdır. İki inverter, toplam 1000 kWh dört batarya kabini (toplam 400 kW şarj/deşarj sınırı), fabrika dağıtım panosu ve dış servis avlusunda 1200 kW çift yönlü trafo vardır. Yeni modeller prosedüreldir; bunlara özel GLB verilirse mevcut model desteğiyle değiştirilebilir. `solarRevision=1` kayıt geçişi önceki yerleşimi yedekler; JSON aktarımı kapasite, trafo sınırı, satış tercihi ve tarifeleri taşır.

Simülasyon saati 06:00'da başlar. Açık gökyüzü güneş profili gündüz üretir, gece sıfırdır; görsel gündüz/gece seçimi elektrik hesabının saatini değiştirmez. İşleyen makinelerin tahmini elektrik yükü hesaplanır. Güneş önce tüketimi karşılar, kalan bataryaya gider; batarya/şarj limiti sonrasındaki fazlalık trafo sınırına kadar satılır. Açık varsayılan satış seçeneği kapatılırsa fazlalık kısılır. Gece batarya, ardından şebeke kullanılır. Batarya doluluğu, şarj/deşarj kayıpları, toplam üretim, alım, satılan kWh, gelir ve alış maliyeti izlenir. Paneldeki 2,5 TL/kWh satış ve 4 TL/kWh alış bedelleri değiştirilebilir kurgusal senaryo değerleridir; güncel piyasa tarifesi değildir.

İnverter arızası AC üretimini azaltır; batarya arızası şarj/deşarj gücünü azaltır. Trafo arızası dış alım/satımı keser. Ana dağıtım panosu veya yetersiz besleme üretimi elektrik beklemesine geçirir. Model güç akışı ve enerji bilançosudur; gerçek şebekeye satış ya da fiziksel bağlantı yapmaz. Çatı taşıyıcısı, yangın tasarımı, elektrik projesi ve şebeke mevzuatı için bir mühendislik hesabı değildir.

Testler güneş/batarya enerji bilançosunu, öğlen şarj ve fazla üretim satışını, gece deşarj ve şebeke alımını, satış kapalıyken kısılmayı ve şebekesiz besleme açığını doğrular. Mevcut üretim ve 74 güzergâh testleri korunur. Varsayılan yerleşim 7 bina ve 91 ekipmandır. `?inspect=power` yeni elektrik odasını açar; genel görünüm çatılardaki panelleri gösterir.

Canlı önizlemede 3.402 panel (1.871,1 kWp DC) görüldü. G1 08:14 örneğinde 913,4 kW güneş, 667,4 kW fabrika yükü ve 246 kW batarya şarjı; G1 11:29 örneğinde %100 batarya, 1.632,1 kW güneş, 704,8 kW tüketim ve 927,3 kW satış izlendi. Aynı örnekte toplam 1.007,5 kWh satış / 2.518,7 TL kurgusal gelir vardı. Üretim, gece alımı, güç bilançosu ve elektrik arızası testleri geçti. 1239 × 1409 sahnede kısa genel görünüm örneği 16 FPS, elektrik odası 20 FPS gösterdi. Üretim derlemesi yeniden çalıştırılmadı.

### Makine, parti, operatör ve iş tüketimi
Makine listesinde aktif parti numarası görünür; makine seçildiğinde operatör sicili/adı, anlık kaynak debileri ve aktif/son işin toplam tüketimleri gösterilir. Operatör ataması detay panelinden kaydedilir ve yerleşim JSON aktarımında korunur. Atama yoksa açıkça simülasyon operatörü kullanılır.

Elektrik kW, su m³/sa, buhar kg/sa ve kazanda doğalgaz Nm³/sa olarak gösterilir. İş toplamları kWh, m³ ve kg ile aktif işlem süresinden hesaplanır; arıza veya yardımcı tesis beklemesinde artmaz. Son iş özeti yeni parti başladığında sıfırlanır. Bekleme elektriği iş toplamına eklenmez. Kazanın su ihtiyacı ve doğalgazı ortak buhar yükünden hesaplanır; doğalgaz ayrı ayrı buhar kullanan makinelere yeniden yazılmaz. Ütü ve kompaktörün buhar talebi mevcut kazan simülasyonuna dahil edilmiştir.

Bu değerler düzenlenebilir simülasyon tahminleridir; gerçek sayaç ölçümü veya operatör kayıt sistemi bağlantısı değildir. Makine elektrik gücü güneş/batarya senaryosunun fabrika yükünde aynı ortak hesapla kullanılır. Yeni MachineState operator/resources/job alanları isteğe bağlıdır, eski canlı veri mesajları çalışmaya devam eder. Görsel dışa aktarma seçilen makinenin iş ve kaynak özetini de içerir.


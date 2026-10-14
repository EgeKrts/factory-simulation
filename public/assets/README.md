# Yerel modeller

Modeller bu klasörden yüklenir. Yeni dosya ekledikten sonra önizlemeyi yenileyin. GLB tercih edilir; GLTF kullanılırsa bağlı `.bin` ve dokuları da aynı göreli dizin yapısında tutun.

`manifest.json` dosyasında makine, hareketli araç ve ürün eşlemeleri bulunur. Mevcut `ht.glb`, `ramoz.glb`, `kompaktor.glb`, `kumas-kontrol.glb`, `kumas-araba.glb`, `buhar-kazani.glb` ve `boya-hazirlama.glb` kullanılır. `halat-acma.glb` korunmuştur; mevcut üretim şemasında ayrı halat açma istasyonu bulunmadığı için bir makineye rastgele uygulanmaz. İstenilen istasyonun yerleşim JSON'undaki `asset` alanına dosya adı yazılarak atanabilir.

Yeni `forklift.glb` hareketli araçlarda, `kamyon.glb` hem park etmiş hem giriş/sevkiyat kamyonlarında kullanılır. Konfeksiyon klasöründeki kesim makinesi, dikim bandı, ütü masası, paketleme masası ve palet/koli modelleri de bağlıdır. `stations.GQC-01` kalite kontrol masasını sadece konfeksiyon son kontrolüne uygular. `cargo.pallet` için mevcut `konfeksiyon/palet-koli.glb` kullanılır. Diğer ekipmanlar ek bir istasyon tanımlandığında aynı eşleme sistemiyle atanabilir.

Yeni araçlar için varsayılan adlar:

| Dosya | Kullanım |
|---|---|
| `forklift.glb` | Binalar arası taşıma ve tüm paletler |
| `kumas-araba.glb` | İç mekânda kumaş/hazne taşıma |
| `tasima-arabasi.glb` | Kesim demetleri ve koliler |
| `kumas-topu.glb` | Ham ve bitmiş kumaş topu |
| `koli.glb` | Koli |
| `palet-yuklu.glb` | Palet dahil paketlenmiş tam yük |

Dosya yoksa fiziksel yük noktası olan yerel prosedürel model kullanılır. Modelin kaynak birimi otomatik olarak metre cinsindeki sınırlara sığdırılır ve tabanı zemine oturtulur. Ham kumaş/top/koli modellerinin altına taşıma paleti eklenir; `palet-yuklu.glb` kendi paletini içermelidir. Aktarılan malzemeler korunur.

Eşleme bir dosya adı veya ayar nesnesi olabilir:

```json
{
  "carriers": {
    "forklift": {
      "file": "benim-forkliftim.glb",
      "rotationY": 90,
      "loadPoint": [0, 0.35, 0]
    }
  }
}
```

`rotationY` derece cinsindedir. `loadPoint`, normalize edilmiş aracın yük soketidir: x/z yatay ofset, y yükün tabanının seyahat yüksekliğidir. Araç bu soket ürünün navigasyon güzergâhına oturacak şekilde konumlandırılır; yükleme ve indirmede yük zemine iner. Standart yön +X ileri, +Y yukarıdır. Varsayılan forklift gövdesi yük noktasının arkasına oturtulur; kumaş ve koli arabalarının platformu yük noktasının altındadır.

Makine tipleri: `ht_jet`, `stenter`, `compactor`, `inspection`, `cart`, `boiler`, `dyeprep`, `raw_entry`, `raw_store`, `spread`, `cut`, `sew`, `hanger`, `iron`, `form_finish`, `conveyor`, `pack`, `pallet`, `warehouse`, `dock`, `truck_out`. Tek istasyonun `asset` alanı tip eşlemesinden önce gelir.

Ham depo modelleri `ham-kumas-depo` klasöründen bina incelemesine yüklenir. `Warehouse shell`, `raf`, `Stock control station`, `Dock door`, `Floor marking tile`, `Pallet jack worker`, `Small props`, `planter`, `Bollard` ve `Fabric lot pallet` kullanılır. İç parçaları kesmek gereken kabuk/kapı önce ayrı meshlerle yüklenir, sonra birleştirilir. Dosyalardaki geometri ve dokular korunur; metre ölçüsüne göre ölçeklenir. Taşınan gerçek ham depo stokları verilen parti paleti modelini kullanır.

Konfeksiyonun `serim-makinesi`, `kesim-makinesi`, `dikis-istasyonu`, `aski-tasima-sistemi`, `kalite-kontrol-masasi`, `utu-masasi`, `form-finisher`, `rulo-konveyor` ve `paketleme-masasi` modelleri çalışan aşamalara bağlıdır. `aski-rafi` bina içindeki bekleme raflarında, `palet-koli` mamul depoda ve taşınan paletlerde kullanılır. Dikim bandında verilen istasyon modeli iki modül olarak çoğaltılır; operatörler ve hareketli parçalar modelin üzerine eklenir. Modeller sabit kaynak olarak paylaşılır, çalışan hareketler simülasyon verisinden üretilir.

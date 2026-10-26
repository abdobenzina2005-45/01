# مصادر وقيود مزودي الخرائط

- سياسة بلاطات OpenStreetMap الرسمية: https://operations.osmfoundation.org/policies/tiles/
  - تمنع التنزيل الجماعي أو التخزين المسبق واستخدام offline من خوادم tile.openstreetmap.org.
- شروط Nominatim الرسمية: https://operations.osmfoundation.org/policies/nominatim/
  - أقصى طلب واحد في الثانية، مع إظهار مصدر البيانات، وتمنع طلب قوائم POI الكاملة دوريًا.
- توثيق Overpass API العام: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
  - يذكر حدودًا تقريبية للاستخدام العادل ويوصي بتجنب اعتماد التطبيقات العامة على الخوادم العامة كمخزن بيانات كامل.
- قائمة خوادم Overpass العامة في ويكي OpenStreetMap: https://wiki.openstreetmap.org/wiki/Overpass_API
  - توضح أن الخوادم المجانية قد تكون مزدحمة، وتعرض قواعد الاستخدام للخوادم، بما فيها احتياج التطبيق إلى User-Agent/Referer وتعليمات التهدئة عند أخطاء 429/406. اختُبر خادم خرائط VK (`https://maps.mail.ru/osm/tools/overpass/api/interpreter`) وخادم Private.coffee (`https://overpass.private.coffee/api/interpreter`) مع بقاء `overpass-api.de` احتياطيًا.
- OpenFreeMap الرسمي: https://openfreemap.org/
  - يسمح بتنزيل مناطق offline حتى 3,000 بلاطة أو 50 ميغابايت لكل تنزيل، وبحد أقصى أربعة طلبات متوازية؛ يلزم تمييز التطبيق.
- دليل OpenFreeMap السريع: https://openfreemap.org/quick_start/
  - نمط Liberty بعنوان https://tiles.openfreemap.org/styles/liberty ويستخدم MapLibre GL.
- توثيق بحث Nominatim لحدود المكان: https://nominatim.org/release-docs/latest/api/Search/
  - يدعم polygon_geojson لإرجاع الشكل الجغرافي للنتيجة.
- خادم التوجيه FOSSGIS/OSRM: https://routing.openstreetmap.de/about.html
  - يوفّر ملفات للمشاة والدراجات والسيارات. تشترط سياسة الاستخدام رابط الإسناد وUser-Agent وReferer صحيحين، وتحدّ الطلب بمرة واحدة في الثانية وتمنع الاستخدام الكثيف؛ كما تسجّل طلبات المسارات في سجل الخادم.
- توثيق Route API لـ OSRM: https://project-osrm.org/docs/v5.24.0/api/
  - يدعم إرجاع هندسة المسار بصيغة GeoJSON مع المسافة والمدة.

بناءً على ذلك تستخدم الميزة خادمًا وسيطًا محصورًا بمضيف OpenFreeMap، وتخزن بلاطات المدينة في IndexedDB ضمن سقف 3,000 بلاطة/50 ميغابايت، ولا تستخدم تنزيل البلاطات من خوادم OSM القياسية. طلبات قائمة المساجد تُطلق بطلب المستخدم، وتُرسل إلى خوادم Overpass البديلة بوسم User-Agent. عند اختيار مسجد، يطلب التطبيق مسار مشاة من FOSSGIS/OSRM ثم يرسم هندسة الطريق ويعرض المسافة والزمن؛ يقيّد الوسيط الطلبات بمعدل لا يتجاوز مرة في الثانية ويخزن آخر مسار محليًا. توضح الواجهة أن إحداثيات البحث والمسار تُرسل لخدمات OpenStreetMap وقد تُسجّل لدى خادم التوجيه، مع إظهار رابط إصلاح بيانات الخريطة.

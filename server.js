const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());
app.use(express.static('.'));

// ============================================
// 🔧 هتعدل البيانات دي بعدين من حساب ميداسباي
// ============================================
const MIDAS_APP_ID = 'حط_رقم_التطبيق_بتاعك_هنا';
const MIDAS_SECRET_KEY = 'حط_المفتاح_السري_هنا';

// صفحة العميل الرئيسية
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// إنشاء طلب دفع وتحويل العميل لميداسباي
app.post('/create-order', async (req, res) => {
    try {
        const { userId, productAmount } = req.body;
        
        if (!userId || !productAmount) {
            return res.status(400).json({ error: 'بيانات ناقصة' });
        }
        
        const orderId = 'ORD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        
        const paymentData = {
            app_id: MIDAS_APP_ID,
            open_id: userId,
            product_id: productAmount,
            order_id: orderId,
            ts: Math.floor(Date.now() / 1000)
        };
        
        const signature = generateSignature(paymentData);
        
        // رابط دفع ميداسباي
        const paymentUrl = `https://api.midasbuy.com/v1/payment?app_id=${MIDAS_APP_ID}&open_id=${userId}&product_id=${productAmount}&order_id=${orderId}&ts=${paymentData.ts}&sign=${signature}`;
        
        res.json({ paymentUrl });
        
    } catch (error) {
        console.error('خطأ في إنشاء الطلب:', error);
        res.status(500).json({ error: 'حدث خطأ، حاول مرة أخرى' });
    }
});

// استلام إشعار الدفع من ميداسباي (الشحن التلقائي)
app.post('/midas-webhook', (req, res) => {
    console.log('📩 وصل إشعار جديد:', JSON.stringify(req.body, null, 2));
    
    const notification = req.body;
    const signature = req.headers['x-midas-signature'];
    
    // التحقق من صحة الإشعار
    if (!verifyWebhookSignature(notification, signature)) {
        console.log('❌ توقيع غير صحيح');
        return res.status(401).send('توقيع غير صحيح');
    }
    
    const { order_id, open_id, status, product_id, amount } = notification;
    
    if (status === 'paid') {
        console.log(`✅ تم الدفع بنجاح للاعب: ${open_id}`);
        console.log(`📦 المنتج: ${product_id} | المبلغ: ${amount}`);
        
        // 🔥 هنا تقوم بتسليم الشحن للاعب 🔥
        deliverProduct(open_id, product_id, amount);
        
        res.status(200).send('تم استلام الإشعار وتسليم الشحن');
    } else {
        console.log(`⚠️ حالة الطلب: ${status}`);
        res.status(200).send('إشعار مستلم');
    }
});

// ============================================
// 🔥 دالة تسليم الشحن (هتعدلها حسب نظامك)
// ============================================
function deliverProduct(userId, productId, amount) {
    // هنا تضيف الكود اللي بيشحن اللاعب تلقائياً
    // مثلاً:
    // - لو عندك API للعبة، اتصل بيها هنا
    // - لو عندك قاعدة بيانات، خزن فيها إن الطلب تم
    
    console.log(`🎉 تم شحن ${userId} بـ ${productId} UC`);
    
    // مثال: لو عايز ترجع رد لـ Telegram أو أي حاجة
    // sendTelegramMessage(`✅ تم شحن ${userId} بنجاح`);
}

// ============================================
// دوال مساعدة (مت تغير فيها حاجة)
// ============================================

function generateSignature(data) {
    const sortedKeys = Object.keys(data).sort();
    const signString = sortedKeys.map(key => `${key}=${data[key]}`).join('&');
    return crypto.createHmac('sha256', MIDAS_SECRET_KEY).update(signString).digest('hex');
}

function verifyWebhookSignature(body, signature) {
    if (!signature) return false;
    const expectedSign = generateSignature(body);
    return expectedSign === signature;
}

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ════════════════════════════════════════════
    ✅ الموقع شغال على: http://localhost:${PORT}
    📡 Webhook endpoint: /midas-webhook
    ════════════════════════════════════════════
    `);
});
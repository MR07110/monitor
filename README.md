# 🖥️ Web Remote Desktop

Web brauzer orqali Linux kompyuteringizni masofadan boshqarish imkonini beruvchi yengil, zamonaviy va tezkor tizim (HTML5 Canvas / noVNC + WebSockets).

## ✨ Xususiyatlari
- **O'rnatish oson**: `install.sh` orqali bir buyruq bilan avtomatik o'rnatiladi.
- **Kam resurs sarfi**: Tomcat yoki Guacamole kabi og'ir tizimlarsiz, atigi ~20 MB RAM ishlatadi.
- **Xavfsiz**: Login va Parol bilan himoyalangan, faqat vakolatli foydalanuvchilar kira oladi.
- **Qulay interfeys**: Fit / 100% ekran moslashuvi, to'liq ekran rejimi, klipboard almashish (nusxalash va joylash), Ctrl+Alt+Del.
- **Vercel / Cloud moslashuvchan**: Statik frontend Vercel'da, agent/backend esa kompyuterda ishlay oladi.

## 🚀 O'rnatish va Ishga tushirish

```bash
git clone https://github.com/mrdevs2011/web-remote-desktop.git
cd web-remote-desktop
chmod +x install.sh
./install.sh
```

Yoki login va parolni ko'rsatgan holda:
```bash
./install.sh -u admin -p maxfiy_parol
```

## 🌐 Kirish
- Lokal kompyuterda: `http://localhost:3000`
- Mahalliy tarmoqdagi boshqa qurilmalarda: `http://<KOMPYUTER_IP>:3000`

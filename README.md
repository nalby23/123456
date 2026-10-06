[README.txt](https://github.com/user-attachments/files/33094796/README.txt)
קופת הקבוצה - אתר דינמי על Netlify (בלי גיליון חיצוני)

איך זה עובד
האתר שומר את הנתונים אצל Netlify (שירות Netlify Blobs, חינמי). אתה נכנס למצב מנהל עם סיסמה,
מוסיף הכנסה או הוצאה, והיא נשמרת מיד. כל מי שפותח את הקישור רואה את הנתונים העדכניים.
הקישור לא משתנה לעולם.

חשוב: גרירת תיקייה ל-Netlify Drop לא מפעילה את החלק הדינמי (פונקציות), ולכן מעלים דרך GitHub.
זה נעשה פעם אחת ולוקח כ-10 דקות.

מה יש בתיקייה (אל תשנו את מבנה התיקיות)
  public/index.html
  public/app.js
  netlify/functions/api.mjs
  netlify.toml
  package.json

שלב 1 - חשבון GitHub
נכנסים ל-github.com ופותחים חשבון חינמי (אם אין).

שלב 2 - מאגר חדש והעלאת הקבצים
1. לוחצים על + בפינה העליונה > New repository.
2. נותנים שם (למשל kupa), משאירים Public או Private, ולוחצים Create repository.
3. בעמוד שנפתח לוחצים על הקישור "uploading an existing file".
4. פותחים את קובץ ה-zip במחשב (חילוץ), ואז גוררים את כל התוכן של התיקייה לחלון (התיקיות public ו-netlify וגם הקבצים netlify.toml ו-package.json).
   לא מעלים את קובץ ה-zip עצמו.
5. לוחצים Commit changes.

שלב 3 - חיבור ל-Netlify
1. נכנסים ל-app.netlify.com (אפשר להתחבר עם חשבון GitHub).
2. Add new project > Import an existing project > GitHub, ובוחרים את המאגר.
3. לא משנים שום הגדרה (הכל כבר מוגדר בקובץ netlify.toml).
4. לפני שלוחצים Deploy, אם יש אפשרות להוסיף Environment variables, מוסיפים:
     שם:   ADMIN_PASSWORD
     ערך:  הסיסמה שתבחר (ארוכה ושלא נמצאת בשימוש במקום אחר)
   אם אין אפשרות כזו בשלב הזה, עושים את זה אחרי הפריסה: Project configuration > Environment variables > Add a variable,
   ואז Deploys > Trigger deploy > Deploy project without cache.
5. Deploy.

שלב 4 - שימוש
1. פותחים את הקישור שנתן Netlify (אפשר לשנות את השם שלו ב-Project configuration > Change project name).
2. בתחתית הדף לוחצים "כניסת מנהל" ומכניסים את הסיסמה.
3. עוברים ללשונית "מנהל", מוסיפים הכנסות והוצאות, וצורפים קבלות.
4. שולחים את הקישור לקבוצה. זה הקישור היחיד שצריך.

הערות
- אם משנים את הסיסמה, מעדכנים את ADMIN_PASSWORD ומפעילים Deploy מחדש.
- האתר מתרענן אצל הצופים כל דקה ובכל חזרה לדף.
- אם הכניסה אומרת "סיסמה שגויה, או שלא הוגדרה סיסמה", בדקו שהמשתנה ADMIN_PASSWORD קיים ושהפריסה בוצעה אחריו.

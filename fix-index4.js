const fs=require('fs');
const f='C:\\Users\\ADITYA\\Downloads\\HRP\\packages\\server\\src\\index.ts';
let c=fs.readFileSync(f,'utf8');
c=c.replace(
  'cookie: { cookieName: "refreshToken", signed: false },\n  sign: { expiresIn: "15m" },\n  cookie: { cookieName: "refreshToken", signed: false },',
  'cookie: { cookieName: "refreshToken", signed: false },\n  sign: { expiresIn: "15m" },'
);
fs.writeFileSync(f,c);
console.log('done');

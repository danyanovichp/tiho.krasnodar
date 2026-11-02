'use strict';
const formURL=window.TIHO_PLAN_FORM_URL||'';
if(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(formURL)){
 document.querySelector('#plan-frame').src=formURL;
 document.querySelector('#plan-connection').hidden=true;
 const direct=document.querySelector('#plan-direct');direct.href=formURL;
}
const legal=document.querySelector('#legal-dialog');
document.querySelectorAll('[data-legal]').forEach(button=>button.addEventListener('click',()=>{
 const operator=button.dataset.legal==='operator';
 document.querySelector('#legal-title').textContent=operator?'Сведения об операторе':'Политика конфиденциальности';
 document.querySelector('#legal-text').textContent=operator?'ИП Ганоу Усама Исмаил. ИНН 910215466716, ОГРНИП 320911200086025. По вопросам персональных данных: green-corner-mail@yandex.ru.':'Заявка содержит имя, телефон, количество, день и время получения и комментарий. Данные записываются в Google Таблицу через Google Apps Script для связи по заявке. Обращения по данным: green-corner-mail@yandex.ru. Место хранения данных Google и сроки удаления уточняются. Заявка не является бронью до подтверждения.';
 legal.showModal();
}));
document.querySelector('#close-legal').addEventListener('click',()=>legal.close());

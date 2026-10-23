'use strict';
const formURL=window.TIHO_PLAN_FORM_URL||'';
if(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(formURL)){
 document.querySelector('#plan-frame').src=formURL;
 document.querySelector('#plan-connection').textContent='Планы записываются без имени и телефона. Дождитесь подтверждения записи в форме.';
 const direct=document.querySelector('#plan-direct');direct.href=formURL;direct.textContent='откройте форму отдельно';
}
const legal=document.querySelector('#legal-dialog');
document.querySelectorAll('[data-legal]').forEach(button=>button.addEventListener('click',()=>{
 const operator=button.dataset.legal==='operator';
 document.querySelector('#legal-title').textContent=operator?'Сведения об операторе':'Данные формы';
 document.querySelector('#legal-text').textContent=operator?'Для вопросов: Telegram @danyanovich. Юридическое наименование и реквизиты оператора уточняются.':'Форма планов самовывоза не запрашивает имя и телефон. После подключения Google в закрытую таблицу владельца записываются день, количество коробок, сумма, время записи и случайный ID заявки. ID сохраняется в браузере, чтобы повторное нажатие обновляло запись вместо дубля; очистка данных браузера сбрасывает эту защиту. Форму обслуживает Google Apps Script. Технические журналы и обработка сетевых данных зависят от Google и хостинга сайта. Аналитика и рекламные cookie на сайте не подключены. Планы не являются бронью или оплаченным заказом.';
 legal.showModal();
}));
document.querySelector('#close-legal').addEventListener('click',()=>legal.close());

/**
 * Fallback legal copy.
 *
 * PLACEHOLDER TEXT — NOT LEGAL ADVICE, AND NOT LAUNCH-READY.
 *
 * These templates exist so that the required *structure* is always present and
 * the pages are complete and reviewable before a lawyer supplies final wording.
 * Every section here is one the Bulgarian Consumer Protection Act, the
 * Electronic Commerce Act, or the GDPR requires, so the shape is right even
 * where the prose is provisional.
 *
 * Each page renders CMS content from the Pages collection when it exists and
 * falls back to this. The mandatory headings render either way — that is the
 * point of hardcoding the skeleton rather than leaving the whole page to an
 * editor who might omit a required section.
 *
 * Placeholders in {{BRACES}} are substituted from the Settings global, so
 * filling in the company details once populates every legal page at once.
 */

export type LegalSection = { heading: string; body: string[] }
export type LegalDocument = { title: string; updated: string; sections: LegalSection[] }

const PLACEHOLDER_NOTICE = {
  bg: 'Този текст е примерен и подлежи на юридически преглед преди пускане на сайта.',
  en: 'This text is provisional and requires legal review before launch.',
}

export const PLACEHOLDER_WARNING = PLACEHOLDER_NOTICE

export const LEGAL_CONTENT: Record<'bg' | 'en', Record<string, LegalDocument>> = {
  bg: {
    terms: {
      title: 'Общи условия',
      updated: 'Последна актуализация: {{UPDATED}}',
      sections: [
        {
          heading: '1. Данни за търговеца',
          body: [
            'Настоящият сайт се управлява от {{COMPANY_NAME}}, ЕИК {{UIC}}, със седалище и адрес на управление {{ADDRESS}}.',
            'Контакт: {{EMAIL}}, {{PHONE}}. ДДС номер: {{VAT}}.',
          ],
        },
        {
          heading: '2. Предмет',
          body: [
            'Тези общи условия уреждат отношенията между {{COMPANY_NAME}} и потребителите при продажба на стоки чрез сайта.',
            'С подаването на поръчка потребителят приема настоящите общи условия.',
          ],
        },
        {
          heading: '3. Цени и плащане',
          body: [
            'Всички цени са в евро (EUR) с включен ДДС, освен ако изрично не е посочено друго.',
            'Цената за доставка се посочва отделно преди финализиране на поръчката.',
            'Единственият приет метод на плащане е наложен платеж — плащането се извършва на куриера при получаване на пратката.',
          ],
        },
        {
          heading: '4. Доставка',
          body: [
            'Доставките се извършват чрез Еконт и Спиди — до офис или до адрес, по избор на потребителя.',
            'Срокът за доставка обикновено е между 1 и 3 работни дни на територията на България.',
          ],
        },
        {
          heading: '5. Право на отказ',
          body: [
            'Потребителят има право да се откажe от договора в срок от 14 дни от получаване на стоката, без да посочва причина.',
            'Подробна информация и формуляр за отказ са достъпни на страница „Право на отказ“.',
          ],
        },
        {
          heading: '6. Законова гаранция',
          body: [
            'За всички стоки се прилага законовата гаранция за съответствие от 2 години съгласно Закона за предоставяне на цифрово съдържание и цифрови услуги и за продажба на стоки.',
          ],
        },
        {
          heading: '7. Рекламации',
          body: [
            'Рекламации се приемат на адрес {{EMAIL}}. Отговор се предоставя в законоустановения срок.',
          ],
        },
        {
          heading: '8. Приложимо право и спорове',
          body: [
            'За неуредените въпроси се прилага българското законодателство.',
            'Спорове могат да бъдат отнасяни до Комисията за защита на потребителите или до платформата за онлайн решаване на спорове на Европейската комисия.',
          ],
        },
      ],
    },

    privacy: {
      title: 'Политика за поверителност',
      updated: 'Последна актуализация: {{UPDATED}}',
      sections: [
        {
          heading: '1. Администратор на лични данни',
          body: [
            '{{COMPANY_NAME}}, ЕИК {{UIC}}, {{ADDRESS}}. Контакт по въпроси за защита на данните: {{EMAIL}}.',
          ],
        },
        {
          heading: '2. Какви данни събираме',
          body: [
            'Име и фамилия, имейл адрес, телефонен номер, адрес за доставка или избран офис на куриер, история на поръчките.',
            'Не събираме данни за плащане, тъй като плащането се извършва в брой при доставка.',
          ],
        },
        {
          heading: '3. Основание и цел на обработването',
          body: [
            'Изпълнение на договор (чл. 6, ал. 1, б. „б“ от ОРЗД) — за обработка и доставка на поръчката.',
            'Законово задължение (чл. 6, ал. 1, б. „в“) — за счетоводни и данъчни цели.',
            'Съгласие (чл. 6, ал. 1, б. „а“) — само за маркетингови съобщения, ако сте дали изрично съгласие.',
          ],
        },
        {
          heading: '4. Срок на съхранение',
          body: [
            'Данни за поръчки: 5 години съгласно данъчното законодателство.',
            'Маркетингово съгласие: до неговото оттегляне.',
          ],
        },
        {
          heading: '5. Получатели на данни',
          body: [
            'Куриерски дружества (Еконт, Спиди) — за целите на доставката.',
            'Доставчик на имейл услуги — за изпращане на потвърждения за поръчки.',
            'Не продаваме и не предоставяме лични данни на трети лица за маркетингови цели.',
          ],
        },
        {
          heading: '6. Вашите права',
          body: [
            'Имате право на достъп, коригиране, изтриване, ограничаване на обработването, преносимост на данните и възражение срещу обработването.',
            'За упражняване на правата си, пишете на {{EMAIL}}.',
            'Имате право да подадете жалба до Комисията за защита на личните данни (КЗЛД), гр. София, бул. „Проф. Цветан Лазаров“ 2.',
          ],
        },
      ],
    },

    cookies: {
      title: 'Политика за бисквитки',
      updated: 'Последна актуализация: {{UPDATED}}',
      sections: [
        {
          heading: 'Какво са бисквитките',
          body: [
            'Бисквитките са малки текстови файлове, които се съхраняват на вашето устройство при посещение на сайта.',
          ],
        },
        {
          heading: 'Какви бисквитки използваме',
          body: [
            'Използваме само строго необходими бисквитки. Не използваме аналитични или маркетингови бисквитки.',
            'NEXT_LOCALE — запазва избрания език. Срок: 1 година. Тип: необходима.',
            'kc-cookie-consent — запазва избора ви относно бисквитките. Срок: 1 година. Тип: необходима.',
            'payload-token — сесия за административния панел (само за служители). Срок: 2 часа. Тип: необходима.',
            'Съдържанието на количката се съхранява в localStorage на вашия браузър, а не в бисквитка, и не се изпраща автоматично към сървъра.',
          ],
        },
        {
          heading: 'Управление на бисквитките',
          body: [
            'Можете да изтриете бисквитките чрез настройките на браузъра си. Изтриването на необходимите бисквитки може да наруши работата на сайта.',
          ],
        },
      ],
    },

    withdrawal: {
      title: 'Право на отказ',
      updated: 'Последна актуализация: {{UPDATED}}',
      sections: [
        {
          heading: 'Вашето право',
          body: [
            'Имате право да се откажете от договора в срок от 14 дни, без да посочвате причина.',
            'Срокът започва да тече от деня, в който вие или посочено от вас трето лице получи стоката.',
          ],
        },
        {
          heading: 'Как да упражните правото си',
          body: [
            'Използвайте формуляра по-долу или ни изпратете недвусмислено заявление на {{EMAIL}}.',
            'За да спазите срока, е достатъчно да изпратите съобщението преди изтичане на 14-дневния срок.',
          ],
        },
        {
          heading: 'Последици от отказа',
          body: [
            'Ще ви възстановим всички получени плащания в срок от 14 дни от деня, в който сме уведомени за отказа.',
            'Можем да отложим възстановяването до получаване на стоката обратно.',
            'Вие поемате преките разходи за връщане на стоката.',
          ],
        },
        {
          heading: 'Изключения',
          body: [
            'Правото на отказ не се прилага за: бързо развалящи се стоки; запечатани стоки, които не подлежат на връщане поради хигиенни съображения и са разпечатани след доставката; стоки, изработени по индивидуална поръчка.',
          ],
        },
      ],
    },
  },

  en: {
    terms: {
      title: 'Terms and Conditions',
      updated: 'Last updated: {{UPDATED}}',
      sections: [
        {
          heading: '1. Trader details',
          body: [
            'This site is operated by {{COMPANY_NAME}}, UIC {{UIC}}, registered office {{ADDRESS}}.',
            'Contact: {{EMAIL}}, {{PHONE}}. VAT number: {{VAT}}.',
          ],
        },
        {
          heading: '2. Scope',
          body: [
            'These terms govern the relationship between {{COMPANY_NAME}} and consumers purchasing goods through this site.',
            'By placing an order you accept these terms.',
          ],
        },
        {
          heading: '3. Prices and payment',
          body: [
            'All prices are in euro (EUR) and include VAT unless stated otherwise.',
            'Delivery costs are shown separately before you complete your order.',
            'The only accepted payment method is cash on delivery — you pay the courier when your parcel arrives.',
          ],
        },
        {
          heading: '4. Delivery',
          body: [
            'Deliveries are made by Econt and Speedy, to a courier office or to your address.',
            'Delivery normally takes 1 to 3 working days within Bulgaria.',
          ],
        },
        {
          heading: '5. Right of withdrawal',
          body: [
            'You may withdraw from the contract within 14 days of receiving the goods, without giving a reason.',
            'Full details and a withdrawal form are available on the "Right of Withdrawal" page.',
          ],
        },
        {
          heading: '6. Legal guarantee',
          body: [
            'A two-year legal guarantee of conformity applies to all goods under Bulgarian law.',
          ],
        },
        {
          heading: '7. Complaints',
          body: ['Complaints may be sent to {{EMAIL}} and are answered within the statutory period.'],
        },
        {
          heading: '8. Governing law and disputes',
          body: [
            'Bulgarian law applies to matters not covered by these terms.',
            'Disputes may be referred to the Commission for Consumer Protection or to the European Commission online dispute resolution platform.',
          ],
        },
      ],
    },

    privacy: {
      title: 'Privacy Policy',
      updated: 'Last updated: {{UPDATED}}',
      sections: [
        {
          heading: '1. Data controller',
          body: [
            '{{COMPANY_NAME}}, UIC {{UIC}}, {{ADDRESS}}. Data protection contact: {{EMAIL}}.',
          ],
        },
        {
          heading: '2. What we collect',
          body: [
            'First and last name, email address, phone number, delivery address or chosen courier office, and order history.',
            'We collect no payment data, because payment is made in cash on delivery.',
          ],
        },
        {
          heading: '3. Legal basis and purpose',
          body: [
            'Performance of a contract (Art. 6(1)(b) GDPR) — to process and deliver your order.',
            'Legal obligation (Art. 6(1)(c)) — accounting and tax records.',
            'Consent (Art. 6(1)(a)) — marketing messages only, and only where you have given it.',
          ],
        },
        {
          heading: '4. Retention',
          body: [
            'Order data: 5 years, as required by tax law.',
            'Marketing consent: until withdrawn.',
          ],
        },
        {
          heading: '5. Recipients',
          body: [
            'Courier companies (Econt, Speedy) for delivery.',
            'Our email provider, to send order confirmations.',
            'We do not sell or share personal data with third parties for marketing.',
          ],
        },
        {
          heading: '6. Your rights',
          body: [
            'You have the right of access, rectification, erasure, restriction of processing, data portability, and objection.',
            'To exercise these rights, write to {{EMAIL}}.',
            'You may lodge a complaint with the Commission for Personal Data Protection (CPDP), 2 Prof. Tsvetan Lazarov Blvd, Sofia.',
          ],
        },
      ],
    },

    cookies: {
      title: 'Cookie Policy',
      updated: 'Last updated: {{UPDATED}}',
      sections: [
        {
          heading: 'What cookies are',
          body: [
            'Cookies are small text files stored on your device when you visit a website.',
          ],
        },
        {
          heading: 'Which cookies we use',
          body: [
            'We use strictly necessary cookies only. We use no analytics or marketing cookies.',
            'NEXT_LOCALE — remembers your chosen language. Duration: 1 year. Type: necessary.',
            'kc-cookie-consent — records your cookie choice. Duration: 1 year. Type: necessary.',
            'payload-token — admin panel session (staff only). Duration: 2 hours. Type: necessary.',
            'Your cart is stored in your browser’s localStorage rather than a cookie, and is not sent to the server automatically.',
          ],
        },
        {
          heading: 'Managing cookies',
          body: [
            'You can delete cookies through your browser settings. Deleting necessary cookies may stop parts of the site working.',
          ],
        },
      ],
    },

    withdrawal: {
      title: 'Right of Withdrawal',
      updated: 'Last updated: {{UPDATED}}',
      sections: [
        {
          heading: 'Your right',
          body: [
            'You have the right to withdraw from the contract within 14 days without giving any reason.',
            'The period begins on the day you, or a third party you name, receives the goods.',
          ],
        },
        {
          heading: 'How to exercise it',
          body: [
            'Use the form below, or send us an unambiguous statement at {{EMAIL}}.',
            'To meet the deadline it is enough to send your message before the 14-day period expires.',
          ],
        },
        {
          heading: 'Effects of withdrawal',
          body: [
            'We will refund all payments received within 14 days of being informed of your withdrawal.',
            'We may withhold the refund until we have received the goods back.',
            'You bear the direct cost of returning the goods.',
          ],
        },
        {
          heading: 'Exceptions',
          body: [
            'The right of withdrawal does not apply to: perishable goods; sealed goods unsuitable for return for health or hygiene reasons once unsealed; and goods made to your specification.',
          ],
        },
      ],
    },
  },
}

/** Substitute {{PLACEHOLDERS}} with company details from Settings. */
export function fillPlaceholders(
  text: string,
  values: {
    companyName?: string | null
    uic?: string | null
    vat?: string | null
    address?: string | null
    email?: string | null
    phone?: string | null
    updated?: string
  },
): string {
  return text
    .replace(/\{\{COMPANY_NAME\}\}/g, values.companyName || '[COMPANY NAME]')
    .replace(/\{\{UIC\}\}/g, values.uic || '[UIC]')
    .replace(/\{\{VAT\}\}/g, values.vat || '—')
    .replace(/\{\{ADDRESS\}\}/g, values.address || '[REGISTERED ADDRESS]')
    .replace(/\{\{EMAIL\}\}/g, values.email || '[EMAIL]')
    .replace(/\{\{PHONE\}\}/g, values.phone || '[PHONE]')
    .replace(/\{\{UPDATED\}\}/g, values.updated || '—')
}

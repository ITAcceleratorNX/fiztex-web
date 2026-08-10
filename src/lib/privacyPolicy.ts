/**
 * Политика конфиденциальности PhysTech на двух языках.
 *
 * <p>Источник — `fiztex-back/policy.txt`. Текст перенесён дословно: это
 * юридический документ, и любая правка формулировок здесь — правка документа,
 * а не вёрстки. Менять содержимое можно только вместе с новой редакцией
 * политики, обновляя при этом {@link PolicyDocument#updatedAt}.
 *
 * <p>Лежит данными, а не разметкой, чтобы обе языковые версии гарантированно
 * имели одинаковую структуру разделов и рендерились одним компонентом.
 */

export type PolicyLocale = 'ru' | 'en';

export type PolicyBlock =
  /** Абзац. */
  | { type: 'p'; text: string }
  /** Маркированный список. */
  | { type: 'ul'; items: string[] }
  /** Подзаголовок внутри раздела (3.1, роли в разделе о разграничении доступа). */
  | { type: 'h3'; text: string };

export interface PolicySection {
  title: string;
  blocks: PolicyBlock[];
}

export interface PolicyDocument {
  title: string;
  /** Строка «Дата последнего обновления», как она напечатана в документе. */
  updatedAt: string;
  sections: PolicySection[];
}

const RU: PolicyDocument = {
  title: 'Политика конфиденциальности PhysTech',
  updatedAt: 'Дата последнего обновления: 10 августа 2026 года',
  sections: [
    {
      title: '1. Общие положения',
      blocks: [
        {
          type: 'p',
          text: 'Настоящая Политика конфиденциальности описывает порядок обработки и защиты информации пользователей образовательной платформы PhysTech, включая мобильное приложение и связанные с ним программные компоненты.',
        },
        { type: 'p', text: 'Оператором и разработчиком платформы PhysTech является:' },
        { type: 'p', text: 'ЧАСТНАЯ КОМПАНИЯ TMK TECHNOHORIZON LTD.' },
        { type: 'p', text: 'БИН: 240140900168' },
        { type: 'p', text: 'Республика Казахстан, г. Астана.' },
        { type: 'p', text: 'Контакты по вопросам конфиденциальности и работы платформы:' },
        { type: 'p', text: 'Телефон: +7 747 907 16 22' },
        { type: 'p', text: 'Email: support@tmk-technohorizon.kz' },
        { type: 'p', text: 'Сайт: www.tmk-technohorizon.kz' },
        {
          type: 'p',
          text: 'Используя PhysTech, пользователь подтверждает ознакомление с настоящей Политикой.',
        },
      ],
    },
    {
      title: '2. Назначение платформы PhysTech',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech является закрытой образовательной платформой, предназначенной для организации и сопровождения учебного процесса в образовательных организациях.',
        },
        { type: 'p', text: 'Платформа может использоваться следующими категориями пользователей:' },
        {
          type: 'ul',
          items: [
            'обучающиеся;',
            'родители или законные представители;',
            'преподаватели;',
            'администрация и уполномоченные сотрудники образовательной организации.',
          ],
        },
        {
          type: 'p',
          text: 'Учетные записи пользователей создаются и управляются образовательной организацией и/или её уполномоченными сотрудниками.',
        },
        {
          type: 'p',
          text: 'PhysTech не предназначен для открытой публичной регистрации пользователей.',
        },
      ],
    },
    {
      title: '3. Какие данные обрабатывает PhysTech',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech обрабатывает только информацию, необходимую для предоставления функций образовательной платформы.',
        },
        { type: 'h3', text: '3.1. Данные обучающихся' },
        {
          type: 'p',
          text: 'В зависимости от настроек образовательной организации могут обрабатываться:',
        },
        {
          type: 'ul',
          items: [
            'внутренний персональный код обучающегося;',
            'данные профиля обучающегося;',
            'принадлежность к классу и/или учебной подгруппе;',
            'расписание;',
            'информация об уроках;',
            'посещаемость;',
            'причины отсутствия;',
            'комментарии преподавателя;',
            'домашние задания;',
            'ответы и выполненные задания;',
            'результаты обучения;',
            'оценки и иные образовательные данные, если соответствующие функции используются образовательной организацией.',
          ],
        },
        {
          type: 'p',
          text: 'Для входа обучающегося может использоваться персональный код и PIN-код.',
        },
      ],
    },
    {
      title: '4. Данные родителей или законных представителей',
      blocks: [
        { type: 'p', text: 'Для предоставления родительского доступа PhysTech может обрабатывать:' },
        {
          type: 'ul',
          items: [
            'номер телефона и/или адрес электронной почты;',
            'данные учетной записи;',
            'связь между родителем или законным представителем и обучающимся;',
            'информацию, необходимую для авторизации и восстановления доступа.',
          ],
        },
        {
          type: 'p',
          text: 'Родитель получает доступ только к данным обучающегося или обучающихся, с которыми его учетная запись связана образовательной организацией.',
        },
      ],
    },
    {
      title: '5. Данные преподавателей',
      blocks: [
        { type: 'p', text: 'В отношении преподавателей PhysTech может обрабатывать:' },
        {
          type: 'ul',
          items: [
            'номер телефона и/или адрес электронной почты;',
            'данные учетной записи;',
            'информацию о назначенных предметах;',
            'классах и учебных группах;',
            'расписании;',
            'уроках;',
            'действиях, выполненных преподавателем в рамках образовательного процесса.',
          ],
        },
      ],
    },
    {
      title: '6. Данные администрации образовательной организации',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech может обрабатывать данные учетных записей администраторов и уполномоченных сотрудников образовательной организации, а также историю административных действий, необходимых для:',
        },
        {
          type: 'ul',
          items: [
            'создания и управления учетными записями;',
            'формирования классов и групп;',
            'управления расписанием;',
            'назначения преподавателей;',
            'управления учебными периодами;',
            'организации доступа пользователей;',
            'обеспечения безопасности и контроля действий в системе.',
          ],
        },
      ],
    },
    {
      title: '7. Откуда появляются данные',
      blocks: [
        { type: 'p', text: 'Информация в PhysTech может:' },
        {
          type: 'ul',
          items: [
            'вноситься администрацией образовательной организации;',
            'вноситься преподавателями в рамках учебного процесса;',
            'предоставляться родителями или законными представителями;',
            'предоставляться самим пользователем в пределах доступных ему функций;',
            'автоматически формироваться платформой в процессе её использования.',
          ],
        },
        {
          type: 'p',
          text: 'Например, данные об уроках могут формироваться на основании расписания, а данные о посещаемости — на основании отметок преподавателя.',
        },
      ],
    },
    {
      title: '8. Цели обработки данных',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech использует информацию исключительно для работы образовательной платформы, в том числе для:',
        },
        {
          type: 'ul',
          items: [
            'идентификации и авторизации пользователей;',
            'предоставления доступа к соответствующей учетной записи;',
            'организации учебного процесса;',
            'ведения расписания;',
            'проведения и отображения уроков;',
            'ведения посещаемости;',
            'предоставления домашних заданий;',
            'отображения результатов обучения и оценок;',
            'предоставления информации родителям или законным представителям;',
            'управления образовательным процессом со стороны школы;',
            'обеспечения безопасности платформы;',
            'предотвращения несанкционированного доступа;',
            'ведения истории действий и изменений;',
            'технической поддержки пользователей.',
          ],
        },
        {
          type: 'p',
          text: 'Персональные и образовательные данные не используются для рекламного профилирования.',
        },
      ],
    },
    {
      title: '9. Данные несовершеннолетних',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech предназначен в том числе для использования несовершеннолетними обучающимися в рамках образовательного процесса.',
        },
        {
          type: 'p',
          text: 'Учетная запись обучающегося создается или предоставляется образовательной организацией.',
        },
        {
          type: 'p',
          text: 'Обучающийся не обязан самостоятельно предоставлять номер телефона или адрес электронной почты для использования стандартной ученической учетной записи, если иное не предусмотрено образовательной организацией.',
        },
        {
          type: 'p',
          text: 'Доступ родителей или законных представителей предоставляется только после установления соответствующей связи между родителем и обучающимся в системе.',
        },
        { type: 'p', text: 'PhysTech не использует данные несовершеннолетних для:' },
        {
          type: 'ul',
          items: [
            'рекламы;',
            'рекламного таргетинга;',
            'продажи данных;',
            'коммерческого профилирования;',
            'передачи рекламным сетям.',
          ],
        },
      ],
    },
    {
      title: '10. Разграничение доступа',
      blocks: [
        {
          type: 'p',
          text: 'Доступ к данным пользователей определяется ролью пользователя и его связями внутри образовательной организации.',
        },
        { type: 'h3', text: 'Обучающийся' },
        {
          type: 'p',
          text: 'Получает доступ только к информации, относящейся к его собственной учетной записи и учебному процессу.',
        },
        { type: 'h3', text: 'Родитель или законный представитель' },
        { type: 'p', text: 'Получает доступ только к информации связанных с ним обучающихся.' },
        { type: 'h3', text: 'Преподаватель' },
        {
          type: 'p',
          text: 'Получает доступ только к данным, необходимым для выполнения его обязанностей, включая назначенные уроки, классы, группы и обучающихся.',
        },
        { type: 'h3', text: 'Администрация' },
        {
          type: 'p',
          text: 'Уполномоченные сотрудники образовательной организации могут получать доступ к данным в пределах прав, необходимых для администрирования платформы и образовательного процесса.',
        },
      ],
    },
    {
      title: '11. Передача данных третьим лицам',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech не продаёт персональные или образовательные данные пользователей.',
        },
        { type: 'p', text: 'PhysTech не передаёт персональные или образовательные данные:' },
        {
          type: 'ul',
          items: [
            'рекламным платформам;',
            'рекламным сетям;',
            'брокерам данных;',
            'сторонним аналитическим платформам;',
            'третьим лицам для рекламных или маркетинговых целей.',
          ],
        },
        {
          type: 'p',
          text: 'На момент действия настоящей Политики в приложении не используются сторонние сервисы аналитики, такие как Firebase Analytics, Crashlytics, Sentry или аналогичные инструменты, осуществляющие самостоятельный сбор пользовательских данных.',
        },
        {
          type: 'p',
          text: 'Данные пользователей обрабатываются в рамках программной инфраструктуры PhysTech и не передаются сторонним коммерческим платформам для самостоятельного использования.',
        },
        {
          type: 'p',
          text: 'Если в дальнейшем архитектура или перечень используемых технических сервисов изменится, настоящая Политика будет соответствующим образом обновлена.',
        },
      ],
    },
    {
      title: '12. Реклама',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech не использует персональные и образовательные данные пользователей для рекламы.',
        },
        { type: 'p', text: 'Платформа не осуществляет:' },
        {
          type: 'ul',
          items: [
            'продажу персональных данных;',
            'создание рекламных профилей пользователей;',
            'таргетированную рекламу на основании учебной активности;',
            'рекламу на основании данных несовершеннолетних.',
          ],
        },
      ],
    },
    {
      title: '13. Хранение данных',
      blocks: [
        {
          type: 'p',
          text: 'Данные хранятся в течение периода использования PhysTech образовательной организацией и до момента их удаления или деактивации уполномоченными сотрудниками.',
        },
        {
          type: 'p',
          text: 'Некоторые сведения, связанные с историей образовательного процесса, могут сохраняться после деактивации учетной записи, если их сохранение необходимо:',
        },
        {
          type: 'ul',
          items: [
            'образовательной организации;',
            'для сохранения истории обучения;',
            'для обеспечения целостности учебных записей;',
            'для выполнения применимых юридических или административных требований.',
          ],
        },
        {
          type: 'p',
          text: 'Данные не должны храниться дольше, чем это необходимо для целей, для которых они были получены, с учетом применимых требований законодательства и образовательной организации.',
        },
      ],
    },
    {
      title: '14. Защита данных',
      blocks: [
        {
          type: 'p',
          text: 'TMK TECHNOHORIZON LTD. и образовательная организация принимают разумные организационные и технические меры для защиты информации от:',
        },
        {
          type: 'ul',
          items: [
            'несанкционированного доступа;',
            'неправомерного изменения;',
            'раскрытия;',
            'уничтожения;',
            'утраты.',
          ],
        },
        {
          type: 'p',
          text: 'Доступ внутри платформы ограничивается в соответствии с ролями пользователей.',
        },
        {
          type: 'p',
          text: 'Данные для аутентификации и другие чувствительные технические данные должны храниться в защищённой форме.',
        },
        {
          type: 'p',
          text: 'При этом ни один способ хранения или передачи электронных данных не может гарантировать абсолютную безопасность.',
        },
      ],
    },
    {
      title: '15. Права пользователей',
      blocks: [
        {
          type: 'p',
          text: 'В пределах применимого законодательства пользователь, родитель или законный представитель может обратиться с запросом:',
        },
        {
          type: 'ul',
          items: [
            'о предоставлении информации об обрабатываемых данных;',
            'об исправлении неверных или устаревших данных;',
            'об ограничении обработки, если это применимо;',
            'об удалении учетной записи и данных, если такое удаление допускается;',
            'по иным вопросам обработки персональных данных.',
          ],
        },
        {
          type: 'p',
          text: 'Если данные пользователя были предоставлены образовательной организацией, их исправление или удаление может осуществляться через администрацию соответствующей образовательной организации.',
        },
      ],
    },
    {
      title: '16. Удаление и деактивация учетной записи',
      blocks: [
        {
          type: 'p',
          text: 'Учетные записи PhysTech создаются и управляются образовательной организацией.',
        },
        {
          type: 'p',
          text: 'Для удаления или деактивации учетной записи пользователь, родитель или законный представитель может:',
        },
        {
          type: 'ul',
          items: [
            'обратиться к администрации образовательной организации;',
            'обратиться непосредственно в TMK TECHNOHORIZON LTD.',
          ],
        },
        { type: 'p', text: 'Контакт для обращения:' },
        { type: 'p', text: 'support@tmk-technohorizon.kz' },
        { type: 'p', text: '+7 747 907 16 22' },
        {
          type: 'p',
          text: 'При обработке запроса может потребоваться подтверждение личности или подтверждение связи пользователя с соответствующей учетной записью.',
        },
        {
          type: 'p',
          text: 'После подтверждения запроса учетная запись и связанные с ней данные удаляются или деактивируются в пределах, допустимых законодательством и требованиями образовательной организации.',
        },
        {
          type: 'p',
          text: 'Информация, которую образовательная организация или оператор обязаны сохранить либо которая необходима для сохранения целостности официальной учебной истории, может храниться в течение необходимого периода.',
        },
      ],
    },
    {
      title: '17. Изменения настоящей Политики',
      blocks: [
        { type: 'p', text: 'Настоящая Политика может периодически обновляться в связи с:' },
        {
          type: 'ul',
          items: [
            'изменением функциональности PhysTech;',
            'развитием платформы;',
            'изменением способов обработки информации;',
            'изменением применимых требований законодательства.',
          ],
        },
        {
          type: 'p',
          text: 'Актуальная версия Политики публикуется на официальном сайте TMK TECHNOHORIZON LTD. и/или в PhysTech.',
        },
        { type: 'p', text: 'Дата последнего обновления указывается в начале документа.' },
      ],
    },
    {
      title: '18. Контактная информация',
      blocks: [
        {
          type: 'p',
          text: 'По вопросам настоящей Политики, обработки данных, исправления или удаления информации можно обратиться:',
        },
        { type: 'p', text: 'ЧАСТНАЯ КОМПАНИЯ TMK TECHNOHORIZON LTD.' },
        { type: 'p', text: 'БИН: 240140900168' },
        { type: 'p', text: 'Республика Казахстан, г. Астана' },
        { type: 'p', text: 'Телефон: +7 747 907 16 22' },
        { type: 'p', text: 'Email: support@tmk-technohorizon.kz' },
        { type: 'p', text: 'Сайт: www.tmk-technohorizon.kz' },
      ],
    },
  ],
};

const EN: PolicyDocument = {
  title: 'PhysTech Privacy Policy',
  updatedAt: 'Last updated: August 10, 2026',
  sections: [
    {
      title: '1. General Provisions',
      blocks: [
        {
          type: 'p',
          text: 'This Privacy Policy describes how information is processed and protected in the PhysTech educational platform, including its mobile application and related software components.',
        },
        { type: 'p', text: 'PhysTech is operated and developed by:' },
        { type: 'p', text: 'TMK TECHNOHORIZON LTD., PRIVATE COMPANY' },
        { type: 'p', text: 'BIN: 240140900168' },
        { type: 'p', text: 'Astana, Republic of Kazakhstan.' },
        { type: 'p', text: 'Privacy and support contacts:' },
        { type: 'p', text: 'Phone: +7 747 907 16 22' },
        { type: 'p', text: 'Email: support@tmk-technohorizon.kz' },
        { type: 'p', text: 'Website: www.tmk-technohorizon.kz' },
        {
          type: 'p',
          text: 'By using PhysTech, users acknowledge that they have reviewed this Privacy Policy.',
        },
      ],
    },
    {
      title: '2. Purpose of PhysTech',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech is a closed educational platform intended to support and organize educational processes within educational institutions.',
        },
        { type: 'p', text: 'The Platform may be used by:' },
        {
          type: 'ul',
          items: [
            'students;',
            'parents or legal guardians;',
            'teachers;',
            'administrators and authorized employees of educational institutions.',
          ],
        },
        {
          type: 'p',
          text: 'User accounts are created and managed by the relevant educational institution and/or its authorized personnel.',
        },
        {
          type: 'p',
          text: 'PhysTech is not intended to provide open public user registration.',
        },
      ],
    },
    {
      title: '3. Information Processed by PhysTech',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech processes only information required to provide the functions of the educational platform.',
        },
        { type: 'h3', text: '3.1. Student Information' },
        {
          type: 'p',
          text: 'Depending on the features used by the educational institution, PhysTech may process:',
        },
        {
          type: 'ul',
          items: [
            'an internal personal student code or identifier;',
            'student profile information;',
            'class and/or subgroup membership;',
            'schedules;',
            'lesson information;',
            'attendance records;',
            'reasons for absence;',
            'teacher comments;',
            'homework;',
            'submitted assignments;',
            'academic results;',
            'grades and other educational information where the relevant features are used by the educational institution.',
          ],
        },
        {
          type: 'p',
          text: 'Students may access their accounts using a personal student code and PIN.',
        },
      ],
    },
    {
      title: '4. Parent and Legal Guardian Information',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech may process the following information to provide parent or guardian access:',
        },
        {
          type: 'ul',
          items: [
            'telephone number and/or email address;',
            'account information;',
            'the relationship between the parent or legal guardian and the student;',
            'information required for authentication and account recovery.',
          ],
        },
        {
          type: 'p',
          text: 'Parents and legal guardians may only access information concerning students linked to their account by the educational institution.',
        },
      ],
    },
    {
      title: '5. Teacher Information',
      blocks: [
        { type: 'p', text: 'PhysTech may process:' },
        {
          type: 'ul',
          items: [
            'telephone number and/or email address;',
            'account information;',
            'assigned subjects;',
            'assigned classes and educational groups;',
            'schedules;',
            'lessons;',
            'actions performed by the teacher as part of the educational process.',
          ],
        },
      ],
    },
    {
      title: '6. Educational Institution Administrator Information',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech may process administrator account information and records of administrative activity required to:',
        },
        {
          type: 'ul',
          items: [
            'create and manage accounts;',
            'manage classes and groups;',
            'manage schedules;',
            'assign teachers;',
            'manage academic periods;',
            'manage user access;',
            'maintain security and accountability within the Platform.',
          ],
        },
      ],
    },
    {
      title: '7. Sources of Information',
      blocks: [
        { type: 'p', text: 'Information in PhysTech may be:' },
        {
          type: 'ul',
          items: [
            "entered by the educational institution's administration;",
            'entered by teachers during the educational process;',
            'provided by parents or legal guardians;',
            'provided by users within functions available to them;',
            'automatically generated by the Platform as part of its normal operation.',
          ],
        },
        {
          type: 'p',
          text: 'For example, lesson information may be generated from the school schedule, while attendance information may be created based on teacher attendance records.',
        },
      ],
    },
    {
      title: '8. Purposes of Processing',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech uses information solely to operate and provide the educational platform, including:',
        },
        {
          type: 'ul',
          items: [
            'user identification and authentication;',
            'account access;',
            'organization of the educational process;',
            'schedule management;',
            'lesson management and display;',
            'attendance management;',
            'homework management;',
            'display of academic results and grades;',
            'provision of information to parents and legal guardians;',
            'school administration;',
            'Platform security;',
            'prevention of unauthorized access;',
            'maintenance of activity and change history;',
            'technical support.',
          ],
        },
        {
          type: 'p',
          text: 'Personal and educational information is not used for advertising profiling.',
        },
      ],
    },
    {
      title: "9. Children's and Minors' Information",
      blocks: [
        {
          type: 'p',
          text: 'PhysTech is designed to be used, among others, by minor students as part of an educational process.',
        },
        {
          type: 'p',
          text: 'Student accounts are created or provided by the relevant educational institution.',
        },
        {
          type: 'p',
          text: 'Students are not required to independently provide a telephone number or email address to use a standard student account unless otherwise required by the educational institution.',
        },
        {
          type: 'p',
          text: 'Parent or legal guardian access is granted only after the relevant relationship between the adult and the student has been established in the Platform.',
        },
        { type: 'p', text: "PhysTech does not use children's information for:" },
        {
          type: 'ul',
          items: [
            'advertising;',
            'targeted advertising;',
            'sale of information;',
            'commercial profiling;',
            'disclosure to advertising networks.',
          ],
        },
      ],
    },
    {
      title: '10. Role-Based Access to Information',
      blocks: [
        {
          type: 'p',
          text: "Access to information within PhysTech is determined by the user's role and relationships within the educational institution.",
        },
        { type: 'h3', text: 'Student' },
        {
          type: 'p',
          text: 'Students may access only information related to their own account and educational activities.',
        },
        { type: 'h3', text: 'Parent or Legal Guardian' },
        {
          type: 'p',
          text: 'Parents and legal guardians may access only information related to students linked to their accounts.',
        },
        { type: 'h3', text: 'Teacher' },
        {
          type: 'p',
          text: 'Teachers may access only information required to perform their educational responsibilities, including assigned lessons, classes, groups, and students.',
        },
        { type: 'h3', text: 'Administration' },
        {
          type: 'p',
          text: 'Authorized educational institution personnel may access information within the scope necessary to administer the Platform and the educational process.',
        },
      ],
    },
    {
      title: '11. Disclosure and Sharing with Third Parties',
      blocks: [
        {
          type: 'p',
          text: "PhysTech does not sell users' personal or educational information.",
        },
        {
          type: 'p',
          text: 'PhysTech does not disclose personal or educational information to:',
        },
        {
          type: 'ul',
          items: [
            'advertising platforms;',
            'advertising networks;',
            'data brokers;',
            'third-party analytics platforms;',
            'third parties for advertising or marketing purposes.',
          ],
        },
        {
          type: 'p',
          text: 'As of the effective date of this Privacy Policy, the application does not use third-party analytics or crash-reporting services such as Firebase Analytics, Crashlytics, Sentry, or similar tools that independently collect user information.',
        },
        {
          type: 'p',
          text: 'User information is processed within the PhysTech software infrastructure and is not provided to third-party commercial platforms for their independent use.',
        },
        {
          type: 'p',
          text: 'If the architecture of the Platform or the technical services used by PhysTech change, this Privacy Policy will be updated accordingly.',
        },
      ],
    },
    {
      title: '12. Advertising and Sale of Information',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech does not use personal or educational information for advertising.',
        },
        { type: 'p', text: 'PhysTech does not:' },
        {
          type: 'ul',
          items: [
            'sell personal information;',
            'create advertising profiles of users;',
            'provide targeted advertising based on educational activity;',
            "use children's information for targeted advertising.",
          ],
        },
      ],
    },
    {
      title: '13. Data Retention',
      blocks: [
        {
          type: 'p',
          text: 'Information is retained for as long as the educational institution uses PhysTech and until it is deleted or deactivated by authorized personnel.',
        },
        {
          type: 'p',
          text: 'Certain information relating to educational history may be retained after an account has been deactivated where retention is necessary:',
        },
        {
          type: 'ul',
          items: [
            'for the educational institution;',
            'to maintain academic history;',
            'to preserve the integrity of educational records;',
            'to comply with applicable legal or administrative requirements.',
          ],
        },
        {
          type: 'p',
          text: 'Information should not be retained for longer than necessary for the purposes for which it was obtained, subject to applicable legal and educational requirements.',
        },
      ],
    },
    {
      title: '14. Information Security',
      blocks: [
        {
          type: 'p',
          text: 'TMK TECHNOHORIZON LTD. and the relevant educational institution take reasonable organizational and technical measures designed to protect information against:',
        },
        {
          type: 'ul',
          items: [
            'unauthorized access;',
            'unlawful alteration;',
            'disclosure;',
            'destruction;',
            'loss.',
          ],
        },
        { type: 'p', text: 'Access within the Platform is restricted according to user roles.' },
        {
          type: 'p',
          text: 'Authentication information and other sensitive technical information are intended to be stored in a protected form.',
        },
        {
          type: 'p',
          text: 'However, no electronic storage or transmission method can guarantee absolute security.',
        },
      ],
    },
    {
      title: '15. User Rights',
      blocks: [
        {
          type: 'p',
          text: 'Subject to applicable law, a user, parent, or legal guardian may request:',
        },
        {
          type: 'ul',
          items: [
            'information about the data being processed;',
            'correction of inaccurate or outdated information;',
            'restriction of processing where applicable;',
            'deletion of an account and associated information where permitted;',
            'information regarding other matters concerning personal data processing.',
          ],
        },
        {
          type: 'p',
          text: 'Where user information was provided by an educational institution, correction or deletion may be processed through the administration of that institution.',
        },
      ],
    },
    {
      title: '16. Account Deletion and Deactivation',
      blocks: [
        {
          type: 'p',
          text: 'PhysTech accounts are created and managed by educational institutions.',
        },
        {
          type: 'p',
          text: 'To request deletion or deactivation of an account, a user, parent, or legal guardian may:',
        },
        {
          type: 'ul',
          items: [
            'contact the administration of the relevant educational institution; or',
            'contact TMK TECHNOHORIZON LTD. directly.',
          ],
        },
        { type: 'p', text: 'Requests may be submitted using:' },
        { type: 'p', text: 'Email: support@tmk-technohorizon.kz' },
        { type: 'p', text: 'Phone: +7 747 907 16 22' },
        {
          type: 'p',
          text: "Identity verification or verification of the user's relationship to the relevant account may be required before processing the request.",
        },
        {
          type: 'p',
          text: 'Once a valid request has been confirmed, the account and associated information will be deleted or deactivated to the extent permitted by applicable law and the requirements of the educational institution.',
        },
        {
          type: 'p',
          text: 'Information that the educational institution or Platform operator is required to retain, or that is necessary to preserve the integrity of official educational records, may be retained for the required period.',
        },
      ],
    },
    {
      title: '17. Changes to This Privacy Policy',
      blocks: [
        { type: 'p', text: 'This Privacy Policy may be updated periodically due to:' },
        {
          type: 'ul',
          items: [
            'changes to PhysTech functionality;',
            'development of the Platform;',
            'changes in information-processing practices;',
            'changes in applicable legal requirements.',
          ],
        },
        {
          type: 'p',
          text: 'The current version of this Privacy Policy will be published on the official TMK TECHNOHORIZON LTD. website and/or within PhysTech.',
        },
        {
          type: 'p',
          text: 'The date of the latest update will be displayed at the beginning of this document.',
        },
      ],
    },
    {
      title: '18. Contact Information',
      blocks: [
        {
          type: 'p',
          text: 'Questions regarding this Privacy Policy, information processing, correction, or deletion requests may be directed to:',
        },
        { type: 'p', text: 'TMK TECHNOHORIZON LTD., PRIVATE COMPANY' },
        { type: 'p', text: 'BIN: 240140900168' },
        { type: 'p', text: 'Astana, Republic of Kazakhstan' },
        { type: 'p', text: 'Phone: +7 747 907 16 22' },
        { type: 'p', text: 'Email: support@tmk-technohorizon.kz' },
        { type: 'p', text: 'Website: www.tmk-technohorizon.kz' },
      ],
    },
  ],
};

export const PRIVACY_POLICY: Record<PolicyLocale, PolicyDocument> = { ru: RU, en: EN };

/**
 * Подписи интерфейса самой страницы — тоже на двух языках, иначе EN-версия
 * выглядит наполовину переведённой.
 *
 * <p>Подписей возврата две. Политика открывается из нескольких мест (вход,
 * подвал публичного раздела, экран ввода кода), поэтому обычно уместно «Назад»
 * по истории. Но по прямой ссылке — из магазина приложений или из переписки —
 * истории нет, и возвращать некуда: тогда показывается переход на главную.
 */
export const POLICY_UI: Record<
  PolicyLocale,
  { back: string; home: string; switchTo: string; otherLocale: PolicyLocale }
> = {
  ru: { back: 'Назад', home: 'На главную', switchTo: 'English', otherLocale: 'en' },
  en: { back: 'Back', home: 'Home', switchTo: 'Русский', otherLocale: 'ru' },
};

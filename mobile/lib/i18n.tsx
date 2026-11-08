import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setActiveLocale } from './format';

export type Lang = 'en' | 'ar';

const STORAGE_KEY = 'doublea.lang';

const AR: Record<string, string> = {
  Dashboard: 'لوحة المعلومات',
  Bookings: 'الحجوزات',
  Pending: 'قيد الانتظار',
  Book: 'حجز',
  'Self book': 'حجز ذاتي',
  Month: 'الشهر',
  Patients: 'المرضى',
  Documents: 'المستندات',
  Instruments: 'الأدوات',
  'Available services': 'الخدمات المتاحة',
  Income: 'الدخل',
  Expenses: 'المصروفات',
  Staff: 'الموظفون',
  Settings: 'الإعدادات',
  Language: 'اللغة',
  'Clinic desk': 'مكتب العيادة',
  'Sign out': 'تسجيل الخروج',
  'Close menu': 'إغلاق القائمة',
  'Open menu': 'فتح القائمة',
  'A session is on now': 'هناك جلسة الآن',
  patients: 'المرضى',
  staff: 'الموظفون',
  archive: 'الأرشيف',
  Archive: 'الأرشيف',
  'Sign in': 'تسجيل الدخول',
  'Open the desk': 'افتح المكتب',
  'The same book on Windows, iPhone, and Android.': 'نفس السجل على ويندوز وآيفون وأندرويد.',
  Email: 'البريد الإلكتروني',
  Password: 'كلمة المرور',
  'Checking…': 'جارٍ التحقق…',
  'Enter the desk': 'ادخل المكتب',
  'Demo accounts': 'حسابات تجريبية',
  'Could not sign in.': 'تعذر تسجيل الدخول.',
  'Full desk, staff, and deleting records': 'المكتب كاملاً والموظفون وحذف السجلات',
  'Book, edit, and add documents': 'الحجز والتعديل وإضافة المستندات',
  'See the day and book a visit': 'عرض اليوم وحجز زيارة',
  Sekretariat: 'سكرتاريات',
  'Today’s book, the month, and the sessions for each patient.': 'سجل اليوم والشهر وجلسات كل مريض.',
  Admin: 'مدير',
  'Sub-admin': 'مساعد المدير',
  User: 'مستخدم',
  admin: 'مدير',
  'sub-admin': 'مساعد المدير',
  user: 'مستخدم',
  'Runs the desk, including staff accounts.': 'يدير المكتب، بما في ذلك حسابات الموظفين.',
  'Books, edits, and files documents.': 'يحجز ويعدّل ويحفظ المستندات.',
  'Reads the day and books a visit.': 'يقرأ اليوم ويحجز زيارة.',
  Server: 'الخادم',
  of: 'من',
  Scheduled: 'مجدول',
  Completed: 'مكتمل',
  Cancelled: 'ملغى',
  scheduled: 'مجدول',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  Upcoming: 'القادم',
  History: 'السجل',
  'Occupational therapy': 'العلاج الوظيفي',
  'Speech therapy': 'علاج النطق',
  Physiotherapy: 'العلاج الطبيعي',
  Occupational: 'وظيفي',
  Speech: 'نطق',
  Unassigned: 'غير محدد',
  Private: 'خاص',
  Company: 'شركة',
  Islamic: 'إسلامي',
  Male: 'ذكر',
  Female: 'أنثى',
  Save: 'حفظ',
  Cancel: 'إلغاء',
  Remove: 'حذف',
  Search: 'بحث',
  All: 'الكل',
  Today: 'اليوم',
  Tomorrow: 'غداً',
  Yesterday: 'أمس',
  Previous: 'السابق',
  Next: 'التالي',
  'This month': 'هذا الشهر',
  Filter: 'تصفية',
  Close: 'إغلاق',
  Edit: 'تعديل',
  Optional: 'اختياري',
  None: 'بدون',
  Submit: 'إرسال',
  'Submitting…': 'جارٍ الإرسال…',
  'Saving…': 'جارٍ الحفظ…',
  'Adding…': 'جارٍ الإضافة…',
  'Booking…': 'جارٍ الحجز…',
  'Writing the report…': 'جارٍ كتابة التقرير…',
  Name: 'الاسم',
  'Phone number': 'رقم الهاتف',
  Therapy: 'العلاج',
  Doctor: 'الطبيب',
  'Patient type': 'نوع المريض',
  Gender: 'الجنس',
  Type: 'النوع',
  Role: 'الدور',
  Status: 'الحالة',
  Date: 'التاريخ',
  Notes: 'ملاحظات',
  Reason: 'السبب',
  Start: 'البداية',
  Length: 'المدة',
  Time: 'الوقت',
  Share: 'النسبة',
  Sessions: 'الجلسات',
  Therapies: 'العلاجات',
  Therapists: 'المعالجون',
  'Session mix': 'توزيع الجلسات',
  Active: 'نشط',
  Quiet: 'هادئ',
  Total: 'المجموع',
  Salaries: 'الرواتب',
  Rent: 'الإيجار',
  Services: 'الخدمات',
  Equipment: 'المعدات',
  Files: 'الملفات',
  Patient: 'المريض',
  Clinic: 'العيادة',
  Overview: 'نظرة عامة',
  'Case notes': 'ملاحظات الحالة',
  'Search by name': 'بحث بالاسم',
  'Document name': 'اسم المستند',
  Description: 'الوصف',
  Amount: 'المبلغ',
  Price: 'السعر',
  'New therapy': 'علاج جديد',
  'Find a patient': 'ابحث عن مريض',
  'Find staff': 'ابحث عن موظف',
  'Name or phone': 'الاسم أو الهاتف',
  'Name, phone, or email': 'الاسم أو الهاتف أو البريد',
  'Full name': 'الاسم الكامل',
  'Patient name': 'اسم المريض',
  'What the file is for': 'الغرض من الملف',
  'Blood panel, consent, referral': 'تحليل، موافقة، تحويل',
  'Hassan blood panel': 'تحليل حسن',
  'The case, and what the patient is suffering from': 'الحالة وما يعاني منه المريض',
  'Follow-up, review, intake': 'متابعة، مراجعة، استقبال',
  'What was covered': 'ما تم خلال الجلسة',
  'What happened in the visit': 'ماذا حدث في الزيارة',
  'Anything the desk should know': 'أي شيء ينبغي أن يعرفه المكتب',
  'Leave blank to keep it': 'اتركه فارغاً للإبقاء عليه',
  Nutrition: 'تغذية',
  'Gait belt': 'حزام المشي',
  'What this instrument is used for': 'فيم تُستخدم هذه الأداة',
  'Clinic rent': 'إيجار العيادة',
  Electricity: 'كهرباء',
  'Used for': 'تُستخدم لـ',
  'Choose a PDF, image, text, or Word file': 'اختر ملف PDF أو صورة أو نص أو Word',
  'Choose a photo': 'اختر صورة',
  'Add a document': 'أضف مستنداً',
  'Add a patient': 'أضف مريضاً',
  'Add patient': 'أضف مريضاً',
  'Add a session': 'أضف جلسة',
  'Add account': 'أضف حساباً',
  'Add an instrument': 'أضف أداة',
  'Add a payment': 'أضف دفعة',
  'Add a reservation': 'أضف حجزاً',
  'Add therapy': 'أضف علاجاً',
  'Add payment': 'أضف الدفعة',
  'Save document': 'حفظ المستند',
  'Save notes': 'حفظ الملاحظات',
  'Save session': 'حفظ الجلسة',
  'Save patient': 'حفظ المريض',
  'Save instrument': 'حفظ الأداة',
  'Save reminder': 'حفظ التذكير',
  'Generate report': 'إنشاء تقرير',
  'See documents': 'عرض المستندات',
  'See more': 'عرض المزيد',
  'View all': 'عرض الكل',
  'View patient': 'عرض المريض',
  'Book a visit': 'احجز زيارة',
  'Book the visit': 'احجز الزيارة',
  'Book this time': 'احجز هذا الوقت',
  'Book this day': 'احجز هذا اليوم',
  'Book the next visit': 'احجز الزيارة التالية',
  'Open the booking desk': 'افتح مكتب الحجز',
  'Book an open time': 'احجز وقتاً متاحاً',
  'All documents': 'كل المستندات',
  'Back to patients': 'العودة إلى المرضى',
  'Back to patient': 'العودة إلى المريض',
  'Choose someone else': 'اختر شخصاً آخر',
  'Show cancelled': 'إظهار الملغى',
  'Hide cancelled': 'إخفاء الملغى',
  'Change file': 'تغيير الملف',
  'Attach a file': 'إرفاق ملف',
  'Any date': 'أي تاريخ',
  'Or pick a date': 'أو اختر تاريخاً',
  'Next session': 'الجلسة التالية',
  Sort: 'الترتيب',
  'Name A–Z': 'الاسم أ–ي',
  'Name Z–A': 'الاسم ي–أ',
  'Most sessions': 'الأكثر جلسات',
  'Fewest sessions': 'الأقل جلسات',
  'Choose a day': 'اختر يوماً',
  'Previous day': 'اليوم السابق',
  'Next day': 'اليوم التالي',
  'Previous month': 'الشهر السابق',
  'Next month': 'الشهر التالي',
  'Previous patients': 'المرضى السابقون',
  'Next patients': 'المرضى التالون',
  '30 minutes earlier': 'قبل 30 دقيقة',
  '30 minutes later': 'بعد 30 دقيقة',
  'Start time': 'وقت البداية',
  'Length in minutes': 'المدة بالدقائق',
  'Date of birth': 'تاريخ الميلاد',
  'Number of sessions': 'عدد الجلسات',
  'Remaining sessions': 'الجلسات المتبقية',
  'Session note': 'ملاحظة الجلسة',
  'Amount paid': 'المبلغ المدفوع',
  'Type of therapy': 'نوع العلاج',
  'Therapy type': 'نوع العلاج',
  'Doctor following the case': 'الطبيب المتابع للحالة',
  'What was paid': 'ما تم دفعه',
  Document: 'مستند',
  Note: 'ملاحظة',
  'This document refers to': 'هذا المستند يخص',
  'Working now': 'يعمل الآن',
  'How to send': 'طريقة الإرسال',
  'Hours before the session': 'ساعات قبل الجلسة',
  'One time for tomorrow': 'مرة واحدة لغداً',
  'WhatsApp reminders': 'تذكيرات واتساب',
  'Clinic settings': 'إعدادات العيادة',
  'Desk accounts': 'حسابات المكتب',
  Accounts: 'الحسابات',
  'Edit price': 'تعديل السعر',
  'Edit therapy, doctor, and type': 'تعديل العلاج والطبيب والنوع',
  'Close add document': 'إغلاق إضافة المستند',
  'Close add account': 'إغلاق إضافة الحساب',
  '1 document': 'مستند واحد',
  '1 session': 'جلسة واحدة',
  '1 patient': 'مريض واحد',
  '1 payment': 'دفعة واحدة',
  '1 earlier session': 'جلسة سابقة واحدة',
  '1 waiting to be submitted': 'واحد بانتظار الإرسال',
  '1 year': 'سنة واحدة',
  '{n} documents': '{n} مستندات',
  '{n} sessions': '{n} جلسات',
  '{n} patients': '{n} مرضى',
  '{n} payments': '{n} دفعات',
  '{n} earlier sessions': '{n} جلسات سابقة',
  '{n} waiting to be submitted': '{n} بانتظار الإرسال',
  '{n} years': '{n} سنوات',
  '{n} sessions.': '{n} جلسات.',
  'No date of birth on file': 'لا يوجد تاريخ ميلاد في الملف',
  'No phone or email': 'لا يوجد هاتف أو بريد',
  'No phone': 'لا يوجد هاتف',
  'No phone on file': 'لا يوجد هاتف في الملف',
  'No therapy yet.': 'لا يوجد علاج بعد.',
  'No doctor yet.': 'لا يوجد طبيب بعد.',
  'No session number yet.': 'لا يوجد عدد جلسات بعد.',
  'No chart notes yet.': 'لا توجد ملاحظات في الملف بعد.',
  'Nothing booked ahead.': 'لا يوجد حجز قادم.',
  'No earlier sessions.': 'لا توجد جلسات سابقة.',
  'No documents for this patient yet.': 'لا توجد مستندات لهذا المريض بعد.',
  'No documents for this staff member yet.': 'لا توجد مستندات لهذا الموظف بعد.',
  'No archive documents yet.': 'لا توجد مستندات في الأرشيف بعد.',
  'No documents match this search.': 'لا توجد مستندات تطابق البحث.',
  'No patients yet.': 'لا يوجد مرضى بعد.',
  'No staff yet.': 'لا يوجد موظفون بعد.',
  'No one matches this search.': 'لا أحد يطابق البحث.',
  'No one matches that name.': 'لا أحد يطابق هذا الاسم.',
  'No patients': 'لا يوجد مرضى',
  'No patients match these filters.': 'لا يوجد مرضى يطابقون هذه التصفية.',
  'No patients on file.': 'لا يوجد مرضى في الملف.',
  'No therapists on the desk yet.': 'لا يوجد معالجون في المكتب بعد.',
  'No instruments yet.': 'لا توجد أدوات بعد.',
  'No therapies yet.': 'لا توجد علاجات بعد.',
  'No income recorded on this day.': 'لا يوجد دخل مسجّل في هذا اليوم.',
  'Nothing recorded yet.': 'لم يُسجَّل شيء بعد.',
  'No one is booked.': 'لا يوجد أحد محجوز.',
  'No finished sessions are waiting.': 'لا توجد جلسات منتهية بانتظار الإرسال.',
  'No open times on this day.': 'لا توجد أوقات متاحة في هذا اليوم.',
  'No doctors for this therapy yet.': 'لا يوجد أطباء لهذا العلاج بعد.',
  'Not on file': 'غير موجود في الملف',
  'This day\'s book is clear.': 'سجل هذا اليوم فارغ.',
  'Opening the record…': 'جارٍ فتح الملف…',
  'Opening the book…': 'جارٍ فتح السجل…',
  'Opening finished sessions…': 'جارٍ فتح الجلسات المنتهية…',
  'Opening the history…': 'جارٍ فتح السجل…',
  'Adding the month…': 'جارٍ جمع الشهر…',
  'Nothing is waiting': 'لا شيء بانتظار الإرسال',
  'completed of booked sessions': 'مكتمل من الجلسات المحجوزة',
  'On the desk': 'في المكتب',
  'Recorded payments': 'دفعات مسجّلة',
  'Salaries, rent, services, equipment': 'رواتب، إيجار، خدمات، معدات',
  '{n} completed': '{n} مكتمل',
  '{n} upcoming': '{n} قادم',
  '{n} with visits': '{n} لديهم زيارات',
  'Patients, staff, and the archive.': 'المرضى والموظفون والأرشيف.',
  'Documents filed for this staff member.': 'المستندات المحفوظة لهذا الموظف.',
  'Documents for this patient. A report uses only this chart, these session notes, and these files.': 'مستندات هذا المريض. يستخدم التقرير هذا الملف وملاحظات الجلسات وهذه الملفات فقط.',
  'Name, phone, birthday, gender, patient type, therapy, one doctor, and the case.': 'الاسم والهاتف وتاريخ الميلاد والجنس ونوع المريض والعلاج وطبيب واحد والحالة.',
  'Choose a patient first. The visit details open after that.': 'اختر المريض أولاً. تظهر تفاصيل الزيارة بعد ذلك.',
  'Name, phone, therapy, and doctor. A note and a document are optional. Then pick a free time between 7:00 AM and 4:00 PM.': 'الاسم والهاتف والعلاج والطبيب. الملاحظة والمستند اختياريان. ثم اختر وقتاً فارغاً بين 7:00 ص و4:00 م.',
  'Each day shows who is booked, and at what time.': 'كل يوم يبيّن من هو المحجوز وفي أي وقت.',
  'Each therapy keeps the tools it uses. The price is counted as expenses, apart from visit income.': 'كل علاج يحتفظ بالأدوات التي يستخدمها. يُحسب السعر ضمن المصروفات، بمعزل عن دخل الزيارات.',
  'Only an admin can change these.': 'المدير فقط يمكنه تغيير هذه الإعدادات.',
  'Reminders, and the therapies a staff member can be assigned.': 'التذكيرات والعلاجات التي يمكن تعيين موظف لها.',
  'Only an admin can add or remove desk accounts.': 'المدير فقط يمكنه إضافة حسابات المكتب أو حذفها.',
  'Each account has a name, email, password, and phone number.': 'لكل حساب اسم وبريد وكلمة مرور ورقم هاتف.',
  'Payments recorded in {month}.': 'الدفعات المسجّلة في {month}.',
  'Payments in {month}. Add one at a time. Each one stays in the list for this month.': 'دفعات {month}. أضف واحدة في كل مرة. تبقى كل دفعة في قائمة هذا الشهر.',
  'Month total {amount}': 'مجموع الشهر {amount}',
  'Added by {name}': 'أضافه {name}',
  'Next {when}': 'التالي {when}',
  'Paid {amount}': 'دُفع {amount}',
  'Booked by {name}': 'حجزه {name}',
  '{start}–{end} on the timeline': '{start}–{end} على الجدول',
  '{count} on the timeline': '{count} على الجدول',
  '{count} on the timeline · {cancelled} cancelled': '{count} على الجدول · {cancelled} ملغى',
  'Archive files are not tied to a patient or a staff member.': 'ملفات الأرشيف غير مرتبطة بمريض أو موظف.',
  'Select a visit on the timeline to see the patient, the reason, and the note.': 'اختر زيارة على الجدول لرؤية المريض والسبب والملاحظة.',
  'Sessions whose time has finished stay here until they are submitted.': 'الجلسات التي انتهى وقتها تبقى هنا حتى يتم إرسالها.',
  'You can book the visit. A sub-admin or admin changes the status afterward.': 'يمكنك حجز الزيارة. يغيّر المساعد أو المدير الحالة بعد ذلك.',
  'These prices are saved on Instruments for this month.': 'هذه الأسعار محفوظة في الأدوات لهذا الشهر.',
  'Add a therapy here, then assign it when you add or edit a staff account.': 'أضف العلاج هنا، ثم عيّنه عند إضافة حساب موظف أو تعديله.',
  'Choose how many hours before the session the WhatsApp message goes to that patient.': 'اختر عدد الساعات قبل الجلسة التي تُرسل فيها رسالة واتساب إلى المريض.',
  'Choose the time of day. At that time, every patient who has a session tomorrow gets a WhatsApp message.': 'اختر وقت اليوم. في ذلك الوقت، كل مريض لديه جلسة غداً يتلقى رسالة واتساب.',
  'Choose a therapy first so this instrument is listed with the right tools.': 'اختر العلاج أولاً حتى تُدرج هذه الأداة مع الأدوات المناسبة.',
  'One time for tomorrow, at {time}': 'مرة واحدة لغداً، عند {time}',
  'Hours before the session, {lead}': 'ساعات قبل الجلسة، {lead}',
  'At {time}, every patient with a session tomorrow gets a WhatsApp message.': 'عند {time}، كل مريض لديه جلسة غداً يتلقى رسالة واتساب.',
  'A patient is reminded {lead} the session starts.': 'يُذكَّر المريض {lead} من بدء الجلسة.',
  'Could not load documents.': 'تعذر تحميل المستندات.',
  'Could not remove the document.': 'تعذر حذف المستند.',
  'Could not write the report.': 'تعذر كتابة التقرير.',
  'Could not add the document.': 'تعذر إضافة المستند.',
  'Could not download that file.': 'تعذر تنزيل الملف.',
  'Could not load this patient.': 'تعذر تحميل هذا المريض.',
  'Could not save the record.': 'تعذر حفظ الملف.',
  'Could not add the session.': 'تعذر إضافة الجلسة.',
  'Could not load the dashboard.': 'تعذر تحميل لوحة المعلومات.',
  'Could not load expenses.': 'تعذر تحميل المصروفات.',
  'Could not save that payment.': 'تعذر حفظ هذه الدفعة.',
  'Could not load settings.': 'تعذر تحميل الإعدادات.',
  'Could not add that therapy.': 'تعذر إضافة هذا العلاج.',
  'Could not save that reminder.': 'تعذر حفظ هذا التذكير.',
  'Could not load staff.': 'تعذر تحميل الموظفين.',
  'Could not add that account.': 'تعذر إضافة هذا الحساب.',
  'Could not update that account.': 'تعذر تحديث هذا الحساب.',
  'Could not remove that account.': 'تعذر حذف هذا الحساب.',
  'Could not save the price.': 'تعذر حفظ السعر.',
  'Could not load instruments.': 'تعذر تحميل الأدوات.',
  'Could not add that instrument.': 'تعذر إضافة هذه الأداة.',
  'Could not remove that instrument.': 'تعذر حذف هذه الأداة.',
  'Could not load the month.': 'تعذر تحميل الشهر.',
  'Could not load income.': 'تعذر تحميل الدخل.',
  'Could not load pending sessions.': 'تعذر تحميل الجلسات قيد الانتظار.',
  'Could not book the visit.': 'تعذر حجز الزيارة.',
  'Could not load the doctors.': 'تعذر تحميل الأطباء.',
  'Could not load that day.': 'تعذر تحميل ذلك اليوم.',
  'Could not book that time.': 'تعذر حجز ذلك الوقت.',
  'Could not load this history.': 'تعذر تحميل هذا السجل.',
  'Could not update the visit.': 'تعذر تحديث الزيارة.',
  'Could not search patients.': 'تعذر البحث عن المرضى.',
  'Could not remove {name}.': 'تعذر حذف {name}.',
  'Remove this document?': 'حذف هذا المستند؟',
  'Remove this account?': 'حذف هذا الحساب؟',
  'Remove this instrument?': 'حذف هذه الأداة؟',
  '{name} will no longer be able to sign in.': 'لن يتمكن {name} من تسجيل الدخول بعد الآن.',
  'Name the document. Search uses that name.': 'سمِّ المستند. البحث يستخدم هذا الاسم.',
  'Attach a file.': 'أرفق ملفاً.',
  'Choose a patient.': 'اختر مريضاً.',
  'Choose a staff member.': 'اختر موظفاً.',
  'Choose staff': 'اختر موظفاً',
  'Choose who was paid.': 'اختر من استلم الدفعة.',
  'Say what this payment was for.': 'اذكر الغرض من هذه الدفعة.',
  'Enter the amount.': 'أدخل المبلغ.',
  'Enter a valid amount.': 'أدخل مبلغاً صالحاً.',
  'Add a photo of the instrument.': 'أضف صورة للأداة.',
  'Choose which therapy this instrument belongs to.': 'اختر العلاج الذي تنتمي إليه هذه الأداة.',
  'Name the instrument.': 'سمِّ الأداة.',
  'Say what the instrument is used for.': 'اذكر فيم تُستخدم الأداة.',
  'Enter the price.': 'أدخل السعر.',
  'Choose male or female.': 'اختر ذكراً أو أنثى.',
  'Choose a therapy and one of its doctors.': 'اختر علاجاً وأحد أطبائه.',
  'Enter how many sessions this cover includes.': 'أدخل عدد الجلسات التي يشملها هذا الغطاء.',
  'Could not add the patient.': 'تعذر إضافة المريض.',
  'Use a start time like 09:30, and keep the visit inside the same day.': 'استخدم وقت بداية مثل 09:30، وأبقِ الزيارة في اليوم نفسه.',
  'Enter the length in minutes, like 120.': 'أدخل المدة بالدقائق، مثل 120.',
  'Choose a registered patient.': 'اختر مريضاً مسجّلاً.',
  'This patient has no doctor on file.': 'لا يوجد طبيب لهذا المريض في الملف.',
  'Enter a name.': 'أدخل الاسم.',
  'Enter a valid email.': 'أدخل بريداً صالحاً.',
  'Use a password of at least 6 characters.': 'استخدم كلمة مرور من 6 أحرف على الأقل.',
  'Enter a phone number.': 'أدخل رقم هاتف.',
  'Added “{name}”.': 'تمت إضافة «{name}».',
  'Added {name}.': 'تمت إضافة {name}.',
  'Added {name} as {role}.': 'تمت إضافة {name} بدور {role}.',
  'Updated {name}.': 'تم تحديث {name}.',
  'Added {who}': 'تمت إضافة {who}',
  'Booked {name} for {when}, {start}–{end}.': 'تم حجز {name} في {when}، {start}–{end}.',
  'This overlaps {names}.': 'يتداخل هذا مع {names}.',
  'Added “{name}”. The agent read {read}.{skipped} Review it before clinical use.': 'تمت إضافة «{name}». قرأ الوكيل {read}.{skipped} راجعه قبل الاستخدام السريري.',
  ' {n} could not be read.': ' تعذر قراءة {n}.',
  'Add OPENAI_API_KEY to backend/.env to generate reports.': 'أضف OPENAI_API_KEY في backend/.env لإنشاء التقارير.',
  'AI clinic assistant': 'مساعد العيادة الذكي',
  'An optional assistant that can summarize appointment histories, help staff find records, draft administrative messages, and highlight incomplete documentation.': 'مساعد اختياري يمكنه تلخيص سجلات المواعيد ومساعدة الموظفين في إيجاد الملفات وصياغة الرسائل الإدارية والتنبيه إلى التوثيق الناقص.',
  'Medical summaries should always be reviewed by authorized clinicians.': 'يجب أن يراجع الملخصات الطبية دائماً أطباء مخوّلون.',
  'Digital intake and consent forms': 'نماذج الاستقبال والموافقة الرقمية',
  'Patients complete medical questionnaires, update their information, and electronically sign consent forms before arriving.': 'يكمل المرضى الاستبيانات الطبية ويحدّثون بياناتهم ويوقّعون نماذج الموافقة إلكترونياً قبل الوصول.',
  'Support configurable forms by specialty, signature timestamps, and version history.': 'يدعم نماذج قابلة للضبط حسب التخصص، مع أوقات التوقيع وسجل الإصدارات.',
  'income {income}': 'الدخل {income}',
  'expenses {expenses}': 'المصروفات {expenses}',
  '{taken} of {allotted}': '{taken} من {allotted}',
};

let currentLang: Lang = 'en';

function readStored(): Lang {
  if (Platform.OS === 'web') {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'ar' || value === 'en') return value;
    } catch {
      return 'en';
    }
  }
  return 'en';
}

function latin(value: string | number) {
  const text = String(value);
  if (currentLang !== 'ar' || !/\d/.test(text) || /[\u0600-\u06FF]/.test(text)) return text;
  return `\u2066${text}\u2069`;
}

function applyPatterns(text: string) {
  const minutes = /^(\d+) min$/.exec(text);
  if (minutes) {
    const count = Number(minutes[1]);
    if (count === 1) return 'دقيقة واحدة';
    if (count === 2) return 'دقيقتان';
    if (count <= 10) return `${latin(count)} دقائق`;
    return `${latin(count)} دقيقة`;
  }
  const hours = /^(\d+) hours before$/.exec(text);
  if (hours) {
    const count = Number(hours[1]);
    if (count === 1) return 'قبل ساعة واحدة';
    if (count === 2) return 'قبل ساعتين';
    if (count <= 10) return `قبل ${latin(count)} ساعات`;
    return `قبل ${latin(count)} ساعة`;
  }
  if (text === '1 hour before') return 'قبل ساعة واحدة';
  return null;
}

export function translate(text: string, vars?: Record<string, string | number>) {
  let value = currentLang === 'ar' ? applyPatterns(text) ?? AR[text] ?? text : text;
  if (vars) {
    for (const [key, item] of Object.entries(vars)) {
      value = value.replaceAll(`{${key}}`, latin(item));
    }
  }
  return value;
}

export function plural(count: number, one: string, many: string) {
  if (count === 1) return translate(one);
  return translate(many, { n: count });
}

type LanguageValue = {
  lang: Lang;
  rtl: boolean;
  toggle: () => void;
  t: typeof translate;
  back: string;
  forward: string;
  nameAlign: { textAlign: 'right' } | null;
};

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readStored);

  const toggle = useCallback(() => {
    setLang((current) => {
      const next: Lang = current === 'ar' ? 'en' : 'ar';
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // The choice still applies for this visit.
        }
      }
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'ar' || value === 'en') setLang(value);
      })
      .catch(() => {});
  }, []);

  currentLang = lang;
  setActiveLocale(lang === 'ar' ? 'ar-EG' : 'en');
  const rtl = lang === 'ar';

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.lang = rtl ? 'ar-u-nu-latn' : 'en';
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.title = rtl ? 'سكرتاريات' : 'Sekretariat';
  }

  const value = useMemo<LanguageValue>(
    () => ({
      lang,
      rtl,
      toggle,
      t: translate,
      back: rtl ? '→' : '←',
      forward: rtl ? '←' : '→',
      nameAlign: rtl ? { textAlign: 'right' } : null,
    }),
    [lang, rtl, toggle],
  );

  return (
    <LanguageContext.Provider value={value}>
      <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>{children}</View>
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useI18n must be used inside LanguageProvider.');
  return value;
}

export function LanguageSwitch({ tone = 'paper' }: { tone?: 'paper' | 'pine' }) {
  const { lang, toggle } = useI18n();
  const label = lang === 'ar' ? 'Ar' : 'En';
  const pine = tone === 'pine';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={toggle}
      className="ms-2 items-center justify-center rounded-full px-2 py-1"
      style={{
        borderWidth: 1,
        borderColor: pine ? 'rgba(215, 244, 244, 0.55)' : '#c9e4e4',
        backgroundColor: pine ? 'transparent' : '#ffffff',
      }}
    >
      <Text style={{ fontFamily: 'Outfit_600SemiBold', color: pine ? '#d7f4f4' : '#0f5c5e', fontSize: 11, lineHeight: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

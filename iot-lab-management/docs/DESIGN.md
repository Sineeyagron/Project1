# MOBILE APP DESIGN SYSTEM — React Native Paper + Material 3 + Soft Modern UI

## Purpose

This document is the visual and UX design system for a university classroom / IoT management mobile app.

Use this document as a **design reference and implementation guide** when generating mobile screens.

The app should feel like a real production mobile application designed by an experienced product designer — NOT like an AI-generated dashboard, template, or generic admin panel.

Primary goals:

- Easy to understand at a glance
- Comfortable for daily use
- Clean and modern
- Professional but friendly
- Strong visual hierarchy
- Consistent across every screen
- Mobile-first
- Accessible
- Suitable for university students, teachers, staff, and administrators

The visual foundation is inspired by:

- Material 3 principles
- React Native Paper component patterns
- Modern mobile product design
- Soft gradients and subtle color washes
- Spacious layouts
- Clear typography
- Minimal visual noise

Do NOT blindly reproduce default Material Design styling.
Use Material 3 and React Native Paper as the structural foundation, then customize the visual language for this application.

---

# 1. PRODUCT CONTEXT

The application manages university classrooms and classroom equipment.

Core functions include:

- Browse classrooms
- View classroom information
- View classroom floor plans
- See desks / seats
- See equipment
- Check equipment status
- Borrow equipment
- Return equipment
- Scan QR codes
- View borrowing history
- Receive maintenance / equipment alerts
- View user profile

The application is primarily used on phones.

The UI must prioritize quick recognition and low cognitive load.

---

# 2. DESIGN PERSONALITY

The desired personality:

- Clean
- Calm
- Modern
- Trustworthy
- Practical
- Slightly premium
- Friendly
- Human-designed

Avoid making the interface look:

- Corporate dashboard-like
- Overly futuristic
- Overly colorful
- Like an AI-generated template
- Like a desktop admin panel squeezed into a phone
- Like a generic banking application
- Like a gaming interface

The application should look like a polished university product.

---

# 3. DESIGN FOUNDATION

Use these principles as the foundation:

## Material 3

Use Material 3 ideas for:

- Component hierarchy
- Typography hierarchy
- Buttons
- Inputs
- Navigation
- Dialogs
- Bottom sheets
- States
- Accessibility
- Touch targets

## React Native Paper

When implementing the UI, prefer React Native Paper-style components and patterns where appropriate:

- Card
- Button
- IconButton
- Searchbar
- TextInput
- Chip
- Badge
- Dialog
- Portal
- Snackbar
- Surface
- Divider
- List
- Menu
- FAB
- ActivityIndicator
- ProgressBar

Do not force every UI element into a Paper Card.

Use components only when they improve hierarchy and usability.

---

# 4. CORE VISUAL RULE

The most important visual rule:

## NOT EVERYTHING SHOULD BE A CARD

Use three levels of visual hierarchy:

### Level 1 — Primary

Large visual areas for the most important information.

Examples:

- Classroom status
- Room name
- Important alert
- Current borrowing action

### Level 2 — Secondary

Grouped information.

Examples:

- Equipment groups
- Classroom statistics
- Quick actions
- Recent activity

### Level 3 — Supporting

Low-emphasis information.

Examples:

- Metadata
- Last updated time
- Small status labels
- Secondary descriptions

Use whitespace and typography to separate information before using borders or containers.

---

# 5. COLOR SYSTEM

Use a calm blue-based visual identity.

## Primary

Primary Blue:

#2563EB

Primary Dark:

#1D4ED8

Primary Light:

#60A5FA

## Background

Main background:

#F7F9FC

Surface:

#FFFFFF

Soft Blue Surface:

#EEF5FF

## Text

Primary text:

#172033

Secondary text:

#64748B

Muted text:

#94A3B8

## Semantic Colors

Success:

#10B981

Success Surface:

#ECFDF5

Warning:

#F59E0B

Warning Surface:

#FFFBEB

Error:

#EF4444

Error Surface:

#FEF2F2

Info:

#3B82F6

Info Surface:

#EFF6FF

---

# 6. GRADIENT SYSTEM

Gradients should be extremely subtle.

The gradient is a soft background atmosphere, NOT a decorative rainbow.

Preferred examples:

Primary soft gradient:

#EEF5FF → #FFFFFF

Blue wash:

#EAF2FF → #FFFFFF

Success wash:

#ECFDF5 → #FFFFFF

Warning wash:

#FFFBEB → #FFFFFF

Do not use:

- Strong blue → purple gradients
- Neon gradients
- Rainbow gradients
- Highly saturated backgrounds
- Large glossy gradients
- Excessive glassmorphism

A gradient should usually be visible only as a gentle color wash.

---

# 7. TYPOGRAPHY

Use a clean modern sans-serif.

Preferred:

- Inter
- SF Pro style
- Roboto
- System font

Typography should have clear hierarchy.

Suggested scale:

Display:
32–36 px
Bold

Large heading:
24–28 px
Bold / Semi-bold

Section heading:
18–20 px
Semi-bold

Body:
15–16 px
Regular

Secondary:
13–14 px
Regular

Caption:
11–12 px
Medium

Do not make everything bold.

Use weight and spacing to create hierarchy.

---

# 8. SPACING

Use an 8pt-based spacing system.

Preferred values:

4
8
12
16
20
24
32
40

Typical mobile screen padding:

16–20 px

Large section spacing:

24–32 px

Card internal padding:

16–20 px

Avoid cramped layouts.

Whitespace is part of the design.

---

# 9. CORNER RADIUS

Use modern but restrained rounding.

Small:

8 px

Standard:

12 px

Large:

16 px

Feature surfaces:

20–24 px

Do not round every tiny element excessively.

Buttons can use approximately 12–16 px depending on hierarchy.

---

# 10. ELEVATION AND SHADOWS

Use very subtle shadows.

Cards should feel slightly elevated without looking like floating plastic objects.

Preferred:

- Very low opacity
- Large blur
- Small vertical offset

Avoid:

- Heavy black shadows
- Strong drop shadows
- Multiple shadows
- Floating-card-everywhere appearance

Flat surfaces are preferred when elevation is unnecessary.

---

# 11. ICONOGRAPHY

Use simple outlined or lightly filled icons.

Icons should:

- Be recognizable
- Have consistent stroke weight
- Be visually balanced
- Never overpower text

Use icons for:

- Search
- Classroom
- Equipment
- QR scan
- Notifications
- Profile
- Borrow
- Return
- Warning
- Success
- Navigation

Do not use random emoji as the primary interface icon system.

---

# 12. BUTTONS

Use clear hierarchy.

## Primary button

Filled primary blue.

Example:

"ดูรายละเอียด"

"ยืมอุปกรณ์"

"ยืนยันการยืม"

## Secondary button

Outlined or tonal.

Example:

"ดูแผนผัง"

"ยกเลิก"

## Tertiary action

Text button.

Example:

"ดูทั้งหมด"

Buttons should have:

- Clear labels
- Comfortable touch targets
- Consistent height
- Appropriate icon when useful

Avoid putting 3–5 competing primary buttons next to each other.

---

# 13. SEARCH

Search should feel integrated into the page.

Preferred:

- Rounded search field
- Light surface
- Search icon
- Clear placeholder
- Optional filter button

Example:

"ค้นหาห้องเรียนหรืออุปกรณ์"

Avoid oversized search bars.

---

# 14. STATUS DESIGN

Status should be understandable from both color and text.

Examples:

🟢 พร้อมใช้งาน
🟡 กำลังตรวจสอบ
🔴 มีปัญหา

However, do not rely on color alone.

Use:

- Status dot
- Text label
- Icon when appropriate

Example:

[green dot] พร้อมใช้งาน

---

# 15. CLASSROOM CARD

Classroom cards should prioritize:

1. Room name
2. Current status
3. Important room information
4. Optional preview image / floor plan
5. Main action

Example hierarchy:

CP9524

ห้องเรียน IoT

พร้อมใช้งาน

ชั้น 5 · อาคาร CP

[ดูห้อง]

Do not put too many statistics inside the card.

Use an image or subtle illustration only if it adds meaning.

---

# 16. EQUIPMENT CARD

Equipment should be easy to scan.

Show:

- Equipment image
- Equipment name
- Availability
- Quantity
- Short identifier when needed

Example:

MacBook Air

พร้อมให้ยืม

เหลือ 4 เครื่อง

[ยืม]

Product photos should use consistent aspect ratio.

Avoid inconsistent image sizes.

---

# 17. IMAGE STYLE

Images should feel realistic and consistent.

For equipment:

- Clean product photo
- Neutral background
- Consistent crop
- Similar visual scale

For classroom images:

- Clean room photography or simple floor-plan preview
- Avoid random stock-photo aesthetics

Images should support information rather than decorate empty space.

---

# 18. HOME SCREEN

The Home screen should immediately answer:

1. Where am I?
2. What can I do?
3. What needs my attention?

Recommended structure:

Header

"ห้องเรียน IoT"

Short supporting text

Search

Important / quick action

Classroom section

Recent / relevant information

Alerts if necessary

Bottom navigation

Do not make the Home screen a wall of statistics.

Avoid showing too many dashboard metrics.

The most important content should appear first.

---

# 19. CLASSROOM / FLOOR PLAN SCREEN

The classroom screen should visually communicate the physical space.

Recommended:

- Room name
- Room status
- Floor plan
- Desk / seat positions
- Equipment locations
- Legend
- Optional zoom / pan
- Important room information

The floor plan should feel like a map, not a spreadsheet.

Use subtle colors to distinguish:

- Available
- Occupied
- Selected
- Equipment
- Restricted / unavailable

Keep the visual system simple.

---

# 20. ROOM DETAIL SCREEN

Recommended hierarchy:

Room name

Status

Room photo or floor plan preview

Basic information

Equipment available

Actions

Example:

CP9524

● พร้อมใช้งาน

ชั้น 5 · อาคาร CP

[ดูแผนผัง]

Equipment

Projector
พร้อมใช้งาน

Computer
12 เครื่อง

[ดูอุปกรณ์ทั้งหมด]

Do not overload the screen.

---

# 21. EQUIPMENT SCREEN

The equipment screen should prioritize search and filtering.

Top:

Title

Search

Filter / category

Then:

Equipment list

Each item should clearly communicate availability.

Useful filters:

- ทั้งหมด
- พร้อมให้ยืม
- ถูกยืม
- กำลังซ่อม

Avoid complex filter interfaces unless necessary.

---

# 22. BORROW FLOW

Borrowing should be a short, clear process.

Recommended:

1. Select equipment
2. Review item
3. Select quantity
4. Confirm borrowing
5. Show success state

Confirmation screen should clearly show:

- Item
- Quantity
- Borrower
- Due date
- Location
- Confirm button

Do not hide important information in expandable sections.

---

# 23. QR SCAN

QR scanning should be treated as a primary action.

Use a visually obvious scan area.

Example:

[ QR SCAN VIEW ]

Scan equipment QR code

Supporting text:

"จัดกรอบ QR ให้อยู่ในพื้นที่"

Keep the screen focused.

Do not put unrelated information on the scanning screen.

---

# 24. NOTIFICATIONS

Notifications should be categorized.

Examples:

Maintenance

"โปรเจคเตอร์ห้อง CP9524 ต้องตรวจสอบ"

Borrowing

"การยืม MacBook สำเร็จ"

Reminder

"อุปกรณ์จะครบกำหนดคืนพรุ่งนี้"

Use icons and semantic colors sparingly.

Unread notifications can have a subtle background or indicator.

Avoid huge red alert blocks.

---

# 25. PROFILE

Profile should be simple.

Show:

- User identity
- Role
- Borrowing history
- Account settings
- Help
- Logout

Do not turn Profile into another dashboard.

---

# 26. BOTTOM NAVIGATION

Use 4–5 destinations maximum.

For this app:

ห้องเรียน
อุปกรณ์
แจ้งเตือน
โปรไฟล์

If QR scanning is a major action, consider using a central FAB or contextual action rather than adding another navigation destination.

Navigation should remain visually quiet.

Selected destination:

- Primary color
- Clear icon state
- Clear label

Unselected:

- Neutral gray

---

# 27. FAB

Use a Floating Action Button only when there is a strong primary action.

Potential use:

QR Scan

The FAB should not compete with the bottom navigation.

Avoid multiple FABs.

---

# 28. EMPTY STATES

Empty screens should explain what happened.

Example:

ไม่มีอุปกรณ์ให้ยืม

"ตอนนี้ยังไม่มีอุปกรณ์ที่พร้อมให้ยืม"

[ดูอุปกรณ์ทั้งหมด]

Avoid blank white screens.

---

# 29. LOADING STATES

Prefer skeletons or simple loading indicators.

Do not block the entire application with unnecessary loading screens.

Use:

- Skeleton cards
- Small ActivityIndicator
- Progress indicator

Keep loading visually quiet.

---

# 30. ERROR STATES

Errors should explain:

- What happened
- What the user can do

Example:

ไม่สามารถโหลดข้อมูลห้องเรียนได้

"ลองตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"

[ลองอีกครั้ง]

Avoid technical error codes in the primary message.

---

# 31. SUCCESS STATES

Success feedback should be clear but not dramatic.

Example:

✓ ยืมอุปกรณ์สำเร็จ

MacBook Air
จำนวน 1 เครื่อง

กำหนดคืน 10 ต.ค. 2026

[ดูรายการยืม]

Use Snackbar for lightweight confirmation.

Use a dedicated success screen when the action is important.

---

# 32. DIALOGS AND BOTTOM SHEETS

Use dialogs only for decisions that require confirmation.

Examples:

"ยืนยันการยืมอุปกรณ์?"

"คุณต้องการยืม MacBook Air จำนวน 1 เครื่องใช่หรือไม่"

[ยกเลิก] [ยืนยัน]

For more complex information, prefer a bottom sheet.

Do not use dialogs for ordinary navigation.

---

# 33. RESPONSIVENESS

Design primarily for phones.

Support common widths around:

360 px
390 px
412 px
430 px

Never rely on a fixed screen width.

Content should adapt naturally.

Avoid horizontal overflow.

---

# 34. ACCESSIBILITY

Maintain:

- Strong text contrast
- Touch targets around 44–48 px
- Clear labels
- Meaningful icons
- Color + text for status
- Logical reading order

Do not make text extremely small to fit more information.

---

# 35. MICRO-INTERACTIONS

Use subtle interaction feedback.

Examples:

- Button press opacity
- Card press scale / feedback
- Smooth navigation
- Snackbar
- Selection highlight
- Small status transitions

Avoid excessive animation.

Animations should make the interface feel responsive, not flashy.

---

# 36. DESIGN CONSISTENCY

Every screen must share:

- Same typography
- Same spacing rhythm
- Same colors
- Same radius language
- Same icon style
- Same status system
- Same button hierarchy
- Same navigation

A new screen must look like it belongs to the same application.

---

# 37. IMPORTANT: AVOID AI-GENERATED UI

Do NOT produce:

- Generic dashboard templates
- Excessive cards
- Random gradients
- Glassmorphism everywhere
- Huge statistics
- Giant hero sections
- Excessive rounded rectangles
- Random illustrations
- Random icons
- Too many colors
- Desktop admin UI compressed into a phone
- Fake futuristic UI
- Excessive shadows
- Excessive visual decoration

The UI should look intentionally designed.

If there is a choice between adding decoration and improving hierarchy, choose hierarchy.

---

# 38. STITCH GENERATION INSTRUCTIONS

When generating screens from this document:

1. Preserve the application's existing information architecture.
2. Do not remove important functionality.
3. Improve hierarchy rather than simply decorating the interface.
4. Use Material 3 principles.
5. Use React Native Paper-like component patterns.
6. Keep the interface mobile-first.
7. Use the blue design system defined above.
8. Use soft gradients only as subtle background washes.
9. Use whitespace aggressively.
10. Do not make every section a card.
11. Use realistic mobile UX patterns.
12. Keep navigation consistent.
13. Keep components reusable.
14. Make screens feel related.
15. Prefer simple layouts with strong hierarchy.

---

# 39. COMPONENT MAPPING

When implementing in React Native, prefer:

Page container:
Surface / View

Cards:
Card / Surface

Buttons:
Button

Icon-only actions:
IconButton

Search:
Searchbar

Text input:
TextInput

Status:
Chip / Badge / custom status row

Lists:
List.Item / FlatList

Dialogs:
Dialog + Portal

Temporary feedback:
Snackbar

Primary contextual action:
FAB

Loading:
ActivityIndicator / ProgressBar

Navigation:
Bottom Navigation pattern

---

# 40. THEME CONCEPT

Use a customized Paper-style theme.

Example conceptual theme:

Primary:
#2563EB

Primary Container:
#EEF5FF

Secondary:
#0F766E

Background:
#F7F9FC

Surface:
#FFFFFF

Surface Variant:
#EEF2F7

On Surface:
#172033

On Surface Variant:
#64748B

Error:
#EF4444

Outline:
#CBD5E1

The exact implementation can adapt these values to the project's existing theme.

---

# 41. FINAL DESIGN QUALITY BAR

Before considering a screen complete, ask:

### Hierarchy
- Can I understand the screen in 2–3 seconds?
- Is the most important information visually dominant?

### Spacing
- Does the screen breathe?
- Are sections clearly separated?

### Components
- Are components used intentionally?
- Did we avoid turning everything into cards?

### Color
- Is blue used consistently?
- Are gradients subtle?

### Typography
- Is the title clearly different from body text?
- Is secondary information actually secondary?

### Mobile UX
- Can the screen be comfortably used with one hand?
- Are touch targets large enough?

### Consistency
- Does this screen look like the same app as the other screens?

### Human quality
- Does it look like a real product designer intentionally designed it?
- Or does it look like an AI generated a dashboard?

If it looks like an AI-generated dashboard, simplify it.

---

# 42. CORE DESIGN FORMULA

Use this formula as the default visual direction:

Material 3 structure
+
React Native Paper component patterns
+
Modern mobile UX
+
Soft blue color system
+
Subtle gradients
+
Generous whitespace
+
Clear typography
+
Restrained shadows
+
Realistic classroom / equipment content
=
Polished university classroom management app

Do not copy React Native Paper's default visual appearance.

Use its design principles and component logic as the foundation while maintaining the application's own visual identity.

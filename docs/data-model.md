# Data Model – SmartShip Branch Assistant

## Entity: branches
- id (PK)
- code
- name
- address_line
- district
- province
- postal_code

## Entity: customers
- id (PK)
- name
- phone
- vip_code (nullable)
- line_user_id (nullable)

## Entity: shipments
- id (PK)
- branch_id (FK → branches)
- customer_id (FK → customers)
- sender_name
- sender_phone
- receiver_name
- receiver_phone
- receiver_address_line
- receiver_subdistrict
- receiver_district
- receiver_province
- receiver_postal_code
- vip_code
- status
- created_at
- confirmed_at

# Entity-Relationship diagram


```mermaid
erDiagram
    USERS ||--o{ APPLICATIONS : submits
    PETS ||--o{ APPLICATIONS : "is applied for"
    SHELTERS ||--o{ PETS : houses
    SHELTERS ||--o{ SHELTER_CAPACITY : "sets limits"
    USERS ||--o| ADOPTER_PREFERENCES : sets
    USERS ||--o{ FAVORITES : saves
    PETS ||--o{ FAVORITES : "is saved in"
    USERS ||--o{ WAITLIST : joins
    PETS ||--o{ WAITLIST : "has queue"
    USERS ||--o{ VISITS : books
    PETS ||--o{ VISITS : "is visited in"
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOG : causes
    PETS ||--o{ MEDICAL_RECORDS : has
    USERS ||--o{ MEDICAL_RECORDS : writes
    APPLICATIONS ||--o{ FOLLOWUPS : schedules

    USERS {
        int user_id PK
        string full_name
        string username UK
        string password_hash "scrypt hash"
        string role "admin, adopter, vet"
        string email
        string phone
        datetime created_at
    }
    SHELTERS {
        int shelter_id PK
        string name UK
        string address
        decimal lat
        decimal lng
    }
    SHELTER_CAPACITY {
        int shelter_id PK, FK
        string species PK "7 species"
        int capacity "CHECK >= 0"
    }
    PETS {
        int pet_id PK
        string name
        string species "Dog, Cat, Rabbit, Bird, Guinea Pig, Hamster, Turtle"
        string breed
        string size
        string energy
        boolean good_with_kids
        boolean good_with_pets
        int shelter_id FK
        date intake_date
        string status "Available, Quarantine, Adopted"
        boolean vaccinated
        boolean behavior_checked
        boolean under_treatment
        string photo_url
        boolean featured
        boolean fee_discount
    }
    APPLICATIONS {
        int application_id PK
        int pet_id FK
        int user_id FK
        string status "Submitted, Approved, Rejected"
        int stage "CHECK 0 to 4"
        int match_score "CHECK 0 to 100"
        json details "form answers"
        datetime created_at
    }
    ADOPTER_PREFERENCES {
        int user_id PK, FK
        string species
        string size
        string energy
        string home_type
        string experience
        boolean has_yard
        boolean has_kids
        boolean open_to_special
    }
    FAVORITES {
        int user_id PK, FK
        int pet_id PK, FK
    }
    WAITLIST {
        int user_id PK, FK
        int pet_id PK, FK
        datetime joined_at
    }
    VISITS {
        int visit_id PK
        int pet_id FK
        int user_id FK
        date visit_date
        string slot "UNIQUE with pet and date"
    }
    NOTIFICATIONS {
        int note_id PK
        int user_id FK
        boolean for_admin
        string message
        boolean is_read
    }
    AUDIT_LOG {
        int log_id PK
        int user_id FK
        string action
        datetime created_at
    }
    MEDICAL_RECORDS {
        int record_id PK
        int pet_id FK
        string record_type
        string notes
        date next_due
        int recorded_by FK
    }
    FOLLOWUPS {
        int followup_id PK
        int application_id FK
        int days_after "7, 30 or 90"
        date due_date
        string status
        int rating "CHECK 1 to 5"
        string notes
    }
    DONATIONS {
        int donation_id PK
        int amount "CHECK > 0"
        string note
        datetime created_at
    }
```

## Relationships in words

| Relationship | Cardinality | Meaning |
|---|---|---|
| SHELTERS to PETS | 1 : many | An animal lives in exactly one shelter; a shelter houses many animals |
| SHELTERS to SHELTER_CAPACITY | 1 : many | One row per shelter and species, so any new animal category needs no schema change |
| USERS to APPLICATIONS | 1 : many | An adopter can apply for several animals |
| PETS to APPLICATIONS | 1 : many | Many adopters can apply for one animal; approving one rejects the rest |
| USERS to ADOPTER_PREFERENCES | 1 : 0..1 | An adopter has at most one saved preference profile |
| USERS and PETS through FAVORITES / WAITLIST | many : many | Resolved by tables whose primary key is the pair (user_id, pet_id) |
| APPLICATIONS to FOLLOWUPS | 1 : many | Approval creates three check-ins (7, 30, 90 days) |
| PETS to MEDICAL_RECORDS | 1 : many | Medical history entered by vets and admins |

DONATIONS stands alone on purpose: donors are anonymous and a demo checkout takes no payment details.

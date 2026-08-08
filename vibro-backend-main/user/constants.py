class USER_ROLES:
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    END_USER = "end_user"
    LOCATION_LEADER = "location_leader"
    
class APP_MODULES:
    DASHBOARD = "dashboard"
    ANNOUNCEMENTS = "announcements"
    FORMS = "forms"
    TASKS = "tasks"
    POLLS = "polls"
    LEARNING_TRAINING = "learning_training"
    PLANNER = "planner"
    ATTENDANCE = "attendance"
    GUIDES = "guides"
    ADMINISTRATION = "administration"
    
    ALL = [
        DASHBOARD,
        ANNOUNCEMENTS,
        FORMS,
        TASKS,
        POLLS,
        LEARNING_TRAINING,
        PLANNER,
        ATTENDANCE,
        GUIDES,
        ADMINISTRATION
    ]
    
class GROUP_TYPES:
    RULEBASED = "rulebased"
    NORMAL = "normal"

class RULE_BASED_GROUP_CONDITION_TYPES:
    AND = "and"
    OR = "or"
    
    ALL_TYPES = [
        AND,
        OR
    ]
  
class RULE_BASED_GROUP_FIELDS:
    DEPARTMENT = "department"
    DIVISION = "division"
    SUBDIVISION = "subdivision"
    LOCATION = "location"
    DESIGNATION = "designation"
    
    ALL_FIELDS = [
        DEPARTMENT,
        DIVISION,
        SUBDIVISION,
        LOCATION,
        DESIGNATION
    ]

class RULE_BASED_GROUP_OPERATORS:
    EQUALS = "equals"
    NOT_EQUAL = "not_equal"
    CONTAINS = "contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IS_ONE_OF = "is_one_of"

    ALL_OPERATORS = [
        EQUALS,
        NOT_EQUAL,
        CONTAINS,
        STARTS_WITH,
        ENDS_WITH,
        IS_ONE_OF
    ]
    
class RESTORE_OPTIONS:
    ARCHIVED="archived"
    DELETED="deleted"
    
class BULK_DELETE_MODELS:
    USER = "user"
    GROUP = "group"
    ORGANIZATION = "organization"
    DESIGNATION = "designation"
    DIVISION = "division"
    LOCATION = "location"
    SUBDIVISION = "subdivision"
    DEPARTMENT = "department"

    ALL_MODELS = [
        USER,
        GROUP,
        ORGANIZATION,
        DESIGNATION,
        DIVISION,
        LOCATION,
        SUBDIVISION,
        DEPARTMENT
    ]

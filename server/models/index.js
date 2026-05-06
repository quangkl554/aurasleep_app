const sequelize = require('../config/database');

const User = require('./User');
const Device = require('./Device');
const SleepRecord = require('./SleepRecord');
const SleepRoutine = require('./SleepRoutine');
const RoutineStep = require('./RoutineStep');
const Subscription = require('./Subscription');
const Order = require('./Order');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');
const BlogCategory = require('./BlogCategory');
const BlogPost = require('./BlogPost');
const UserActivityEvent = require('./UserActivityEvent');
const UserSession = require('./UserSession');
const DeviceCommandHistory = require('./DeviceCommandHistory');
const PaymentEvent = require('./PaymentEvent');

// Define Associations

// User -> Device (1 to Many)
User.hasMany(Device, { foreignKey: 'userId', onDelete: 'CASCADE' });
Device.belongsTo(User, { foreignKey: 'userId' });

// User -> SleepRecord (1 to Many)
User.hasMany(SleepRecord, { foreignKey: 'userId', onDelete: 'CASCADE' });
SleepRecord.belongsTo(User, { foreignKey: 'userId' });

// User -> SleepRoutine (1 to Many)
User.hasMany(SleepRoutine, { foreignKey: 'userId', onDelete: 'CASCADE' });
SleepRoutine.belongsTo(User, { foreignKey: 'userId' });

// SleepRoutine -> RoutineStep (1 to Many)
SleepRoutine.hasMany(RoutineStep, { foreignKey: 'routineId', onDelete: 'CASCADE' });
RoutineStep.belongsTo(SleepRoutine, { foreignKey: 'routineId' });

// User -> Subscription (1 to Many)
User.hasMany(Subscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'userId' });

// User -> Order (1 to Many)
User.hasMany(Order, { foreignKey: 'userId', onDelete: 'CASCADE' });
Order.belongsTo(User, { foreignKey: 'userId' });

// User -> ChatSession (1 to Many)
User.hasMany(ChatSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
ChatSession.belongsTo(User, { foreignKey: 'userId' });

// ChatSession -> ChatMessage (1 to Many)
ChatSession.hasMany(ChatMessage, { foreignKey: 'sessionId', onDelete: 'CASCADE' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'sessionId' });

// BlogCategory -> BlogPost (1 to Many)
BlogCategory.hasMany(BlogPost, { foreignKey: 'categoryId' });
BlogPost.belongsTo(BlogCategory, { foreignKey: 'categoryId' });

// User -> Activity Events (1 to Many)
User.hasMany(UserActivityEvent, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserActivityEvent.belongsTo(User, { foreignKey: 'userId' });

// User -> Sessions (1 to Many)
User.hasMany(UserSession, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserSession.belongsTo(User, { foreignKey: 'userId' });

// User/Device -> Command History
User.hasMany(DeviceCommandHistory, { foreignKey: 'userId', onDelete: 'CASCADE' });
DeviceCommandHistory.belongsTo(User, { foreignKey: 'userId' });
Device.hasMany(DeviceCommandHistory, { foreignKey: 'deviceId', onDelete: 'CASCADE' });
DeviceCommandHistory.belongsTo(Device, { foreignKey: 'deviceId' });

// User/Order -> Payment Events
User.hasMany(PaymentEvent, { foreignKey: 'userId', onDelete: 'CASCADE' });
PaymentEvent.belongsTo(User, { foreignKey: 'userId' });
Order.hasMany(PaymentEvent, { foreignKey: 'orderId', onDelete: 'SET NULL' });
PaymentEvent.belongsTo(Order, { foreignKey: 'orderId' });

module.exports = {
    sequelize,
    User,
    Device,
    SleepRecord,
    SleepRoutine,
    RoutineStep,
    Subscription,
    Order,
    ChatSession,
    ChatMessage,
    BlogCategory,
    BlogPost,
    UserActivityEvent,
    UserSession,
    DeviceCommandHistory,
    PaymentEvent
};

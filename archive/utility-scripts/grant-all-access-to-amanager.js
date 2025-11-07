// Quick script to grant all permissions to amanager
// Run this from MongoDB shell or MongoDB Compass

// 1. Find the user
const user = db.users.findOne({ username: "amanager" });
console.log("User:", user);

// 2. Find the user's theater
const theater = db.theaters.findOne({ _id: user.theater });
console.log("Theater:", theater);

// 3. Find the user's role
const role = db.roles.findOne({ 
  theater: theater._id,
  assignedTo: user._id 
});
console.log("Role:", role);

// 4. Find all pages
const allPages = db.pages.find().toArray();
console.log("Total pages:", allPages.length);

// 5. Update all role permissions to grant access
allPages.forEach(page => {
  db.rolepermissions.updateOne(
    { role: role._id, page: page._id },
    { $set: { hasAccess: true } },
    { upsert: true }
  );
  console.log("Granted access to:", page.pageName);
});

console.log("✅ All permissions granted to amanager!");

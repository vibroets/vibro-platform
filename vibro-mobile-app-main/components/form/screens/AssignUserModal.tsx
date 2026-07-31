import React, { useMemo, useState } from "react";
import {
    FlatList,
    Modal,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    StyleSheet
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
// import { UserType } from "@/types"; // adjust path

type TabType = "users" | "groups";

interface Props {
    visible: boolean;
      users: any[];
    selectedUserIds: number[];
    onClose: () => void;
    onSubmit: () => void;
    toggleSelection: (id: number) => void;
}

const AssignUserModal = ({
    visible,
    users,
    selectedUserIds,
    onClose,
    onSubmit,
    toggleSelection,
}: Props) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<TabType>("users");

    const filteredOptions = useMemo(() => {
        if (!Array.isArray(users)) return [];
        return users.filter((user) =>
            `${user.first_name} ${user.last_name}`
                .toLowerCase()
                .includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, users]);

    const renderTabHeader = () => (
        <View style={styles.tabContainer}>
            <TouchableOpacity
                onPress={() => setActiveTab("users")}
                style={[styles.tabButton, activeTab === "users" && styles.activeTab]}
            >
                <Text style={styles.tabText}>Users</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => setActiveTab("groups")}
                style={[styles.tabButton, activeTab === "groups" && styles.activeTab]}
            >
                <Text style={styles.tabText}>Groups</Text>
            </TouchableOpacity>
        </View>
    );

    const renderSearchBar = () => (
        <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChangeText={setSearchQuery}
        />
    );

    const renderButtons = () => (
        <>
            <TouchableOpacity
                onPress={onSubmit}
                style={[styles.button, { backgroundColor: "#007AFF", marginTop: 10 }]}
            >
                <Text style={styles.buttonText}>Assign</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={onClose}
                style={[styles.button, { backgroundColor: "#FF3B30", marginTop: 10 }]}
            >
                <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
        </>
    );

    const renderUserItem = ({ item }: { item: any }) => {
        const fullName = `${item.first_name} ${item.last_name}`;
        const selected = selectedUserIds.includes(item.id);

        return (
            <TouchableOpacity
                style={[styles.optionItem, selected && styles.selectedOptionItem]}
                onPress={() => toggleSelection(item.id)}
            >
                <Text style={styles.optionText}>{fullName}</Text>
                {selected && <MaterialIcons name="check" size={20} color="#007AFF" />}
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {renderTabHeader()}
                    {activeTab === "users" ? (
                        <>
                            {renderSearchBar()}
                            <FlatList
                                data={filteredOptions}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={renderUserItem}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                                ListEmptyComponent={
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>No users found</Text>
                                    </View>
                                }
                                style={{ flexGrow: 0 }}
                            />
                            {renderButtons()}
                        </>
                    ) : (
                        <>
                            <Text style={{ padding: 10 }}>Group list goes here...</Text>
                            {renderButtons()}
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default AssignUserModal;

const styles = StyleSheet.create({
    modalOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
    },
    modalContent: {
        width: "90%",
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 20,
        height: 10
    },
    tabContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderBottomWidth: 2,
        borderColor: "transparent",
    },
    activeTab: {
        borderColor: "#007AFF",
    },
    tabText: {
        fontSize: 16,
        fontWeight: "600",
    },
    optionItem: {
        padding: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    selectedOptionItem: {
        backgroundColor: "#F0F7FF",
    },
    optionText: {
        fontSize: 12,
        flex: 1,
    },
    separator: {
        height: 1,
        backgroundColor: "#eee",
        marginHorizontal: 16,
    },
    emptyContainer: {
        padding: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#999",
    },
    searchInput: {
        borderWidth: 1,
        borderColor: "#ccc",
        padding: 8,
        borderRadius: 8,
        marginVertical: 10,
        marginHorizontal: 10,
    },
    button: {
        backgroundColor: "#007AFF",
        padding: 15,
        borderRadius: 5,
        flex: 1,
        marginHorizontal: 5,
        alignItems: "center",
    },

    buttonText: {
        color: "white",
        fontWeight: "bold",
    },
})

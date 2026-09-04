import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Brand } from "@/constants/theme";
import type { Madhhab } from "@/lib/api";
import { api } from "@/lib/api";
import {
  suggestBulughAge,
  validateQadaSetup,
  type QadaSetupFieldErrors,
} from "@/lib/qadaSetup";
import { getOrCreateSession, type DeviceSession } from "@/lib/session";

/**
 * Day 13: qada setup — collects birth date, bulugh age, gender, and
 * practice-start date, then PATCHes them onto the user's self profile.
 * No new backend schema needed: these four fields already existed on
 * Profile since the Day 7.5 reconciliation, just unused by any UI until
 * now. Reachable from the Home tab's "Set up qada tracking" link.
 */
export default function QadaSetupScreen() {
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [madhhab, setMadhhab] = useState<Madhhab>("hanafi");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [birthDate, setBirthDate] = useState("");
  const [bulughAge, setBulughAge] = useState("");
  const [bulughAgeTouched, setBulughAgeTouched] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [practiceStartDate, setPracticeStartDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<QadaSetupFieldErrors>({});

  useEffect(() => {
    (async () => {
      try {
        const activeSession = await getOrCreateSession();
        setSession(activeSession);

        const profiles = await api.listProfiles({
          username: activeSession.username,
          password: activeSession.password,
        });
        const self =
          profiles.find((p) => p.id === activeSession.profileId) ??
          profiles.find((p) => p.type === "self");

        if (self) {
          setMadhhab(self.madhhab);
          if (self.birth_date) setBirthDate(self.birth_date);
          if (self.bulugh_age != null) {
            setBulughAge(String(self.bulugh_age));
            setBulughAgeTouched(true);
          }
          if (self.gender) setGender(self.gender);
          if (self.practice_start_date)
            setPracticeStartDate(self.practice_start_date);
        }
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : "Could not load your profile. Pull to retry.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Per the spec: bulugh age default is "suggested by madhhab norms,
  // editable." Only auto-fill while the person hasn't typed their own
  // value yet — once touched, picking a different gender shouldn't
  // silently overwrite what they entered.
  const handleGenderSelect = (value: "male" | "female") => {
    setGender(value);
    if (!bulughAgeTouched) {
      const suggested = suggestBulughAge(madhhab, value);
      if (suggested != null) setBulughAge(String(suggested));
    }
  };

  const handleSave = async () => {
    setSaved(false);
    setSaveError(null);

    const result = validateQadaSetup({
      birthDate,
      bulughAge,
      gender,
      practiceStartDate,
    });

    if (result.errors) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});

    if (!session) {
      setSaveError("Could not connect your account. Try again.");
      return;
    }

    setSaving(true);
    try {
      await api.updateProfile(session.profileId, result.values, {
        username: session.username,
        password: session.password,
      });
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save your qada setup.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Brand.muted} />
          <Text style={styles.statusText}>Loading your profile…</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Qada setup</Text>
      <Text style={styles.subtext}>
        These details help estimate the prayers you may still owe, so we can
        help you track paying them down.
      </Text>

      {loadError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{loadError}</Text>
        </View>
      )}
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{saveError}</Text>
        </View>
      )}
      {saved && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>Saved.</Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Birth date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Brand.muted}
          value={birthDate}
          onChangeText={setBirthDate}
          accessibilityLabel="Birth date"
        />
        {fieldErrors.birthDate && (
          <Text style={styles.fieldError}>{fieldErrors.birthDate}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Gender</Text>
        <Text style={styles.helperText}>
          Used only to estimate menstruation days in the qada calculation.
        </Text>
        <View style={styles.genderRow}>
          <Pressable
            onPress={() => handleGenderSelect("male")}
            accessibilityRole="button"
            accessibilityState={{ selected: gender === "male" }}
            style={[
              styles.genderOption,
              gender === "male" && styles.genderOptionSelected,
            ]}
          >
            <Text
              style={[
                styles.genderOptionText,
                gender === "male" && styles.genderOptionTextSelected,
              ]}
            >
              Male
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleGenderSelect("female")}
            accessibilityRole="button"
            accessibilityState={{ selected: gender === "female" }}
            style={[
              styles.genderOption,
              gender === "female" && styles.genderOptionSelected,
            ]}
          >
            <Text
              style={[
                styles.genderOptionText,
                gender === "female" && styles.genderOptionTextSelected,
              ]}
            >
              Female
            </Text>
          </Pressable>
        </View>
        {fieldErrors.gender && (
          <Text style={styles.fieldError}>{fieldErrors.gender}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Bulugh age</Text>
        <Text style={styles.helperText}>
          Age of religious maturity — suggested from your madhhab once you pick
          a gender above, but always editable.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 12"
          placeholderTextColor={Brand.muted}
          value={bulughAge}
          onChangeText={(value) => {
            setBulughAgeTouched(true);
            setBulughAge(value);
          }}
          keyboardType="number-pad"
          accessibilityLabel="Bulugh age"
        />
        {fieldErrors.bulughAge && (
          <Text style={styles.fieldError}>{fieldErrors.bulughAge}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Practice start date</Text>
        <Text style={styles.helperText}>
          The date you began praying consistently and became accountable for
          qada.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Brand.muted}
          value={practiceStartDate}
          onChangeText={setPracticeStartDate}
          accessibilityLabel="Practice start date"
        />
        {fieldErrors.practiceStartDate && (
          <Text style={styles.fieldError}>{fieldErrors.practiceStartDate}</Text>
        )}
      </View>

      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={({ pressed }) => [
          styles.saveButton,
          pressed && styles.saveButtonPressed,
        ]}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator size="small" color={Brand.paper} />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.paper,
  },
  content: {
    padding: 24,
  },
  header: {
    fontSize: 24,
    fontWeight: "600",
    color: Brand.ink,
    marginBottom: 6,
  },
  subtext: {
    fontSize: 13,
    color: Brand.muted,
    marginBottom: 24,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  statusText: {
    fontSize: 13,
    color: Brand.muted,
  },
  errorBanner: {
    backgroundColor: Brand.paperDeep,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  errorBannerText: {
    fontSize: 13,
    color: Brand.muted,
  },
  successBanner: {
    backgroundColor: Brand.paperDeep,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: Brand.accent,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Brand.ink,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: Brand.muted,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Brand.ink,
    backgroundColor: Brand.paper,
  },
  fieldError: {
    fontSize: 12,
    color: Brand.muted,
    marginTop: 6,
  },
  genderRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  genderOptionSelected: {
    backgroundColor: Brand.ink,
    borderColor: Brand.ink,
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: Brand.ink,
  },
  genderOptionTextSelected: {
    color: Brand.paper,
  },
  saveButton: {
    backgroundColor: Brand.ink,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonText: {
    color: Brand.paper,
    fontWeight: "600",
    fontSize: 15,
  },
});
